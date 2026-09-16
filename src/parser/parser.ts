import { TokenType, type Token } from "../lexer/token";
import { InvalidSyntaxError } from "../errors/langError";
import { Position } from "../errors/position";
import {
  BinOpNode,
  BooleanNode,
  CallNode,
  ConstantNode,
  CubicBezierInterpolationNode,
  ExponentialInterpolationNode,
  GetNode,
  IfNode,
  InterpolateNode,
  LinearInterpolationNode,
  MatchNode,
  NumberNode,
  StepNode,
  StringNode,
  UnaryOpNode,
  VarAccessNode,
  VarAssignNode,
  type InterpolateStop,
  type InterpolationType,
  type IfCase,
  type MatchCase,
  type MatchLabel,
  type Node,
  type StepStop,
} from "./nodes";

export class Parser {
  private tokIdx: number;
  private currentToken: Token | undefined;

  constructor(
    public tokens: Token[],
    public text: string,
  ) {
    this.tokIdx = -1;
    this.advance();
  }

  parse(): Node {
    this.skipNewlines();
    const node = this.statementSeq();

    if (this.currentToken !== undefined && this.currentToken.type !== TokenType.EOF) {
      throw new InvalidSyntaxError(
        this.currentToken.posStart,
        this.currentToken.posEnd,
        `Unexpected token: ${this.currentToken}`,
        this.text,
      );
    }

    return node;
  }

  private statementSeq(): Node {
    const first = this.statement();

    if (!this.atNewline()) {
      return first;
    }

    if (!this.moreStatementsFollow()) {
      this.skipNewlines();
      return first;
    }

    if (!(first instanceof VarAssignNode)) {
      throw new InvalidSyntaxError(
        first.posStart,
        first.posEnd,
        "This expression's value is unused -- only a 'var' assignment can be followed by more lines; put the final value on the last line",
        this.text,
      );
    }

    this.skipNewlines();
    first.bodyNode = this.statementSeq();
    return first;
  }

  private moreStatementsFollow(): boolean {
    const next = this.peekPastNewlines();
    return next !== undefined && next.type !== TokenType.EOF;
  }

  private peekPastNewlines(): Token | undefined {
    let idx = this.tokIdx;
    while (this.tokens[idx]?.type === TokenType.NEWLINE) idx++;
    return this.tokens[idx];
  }

  private isKeyword(value: string): boolean {
    return (
      this.currentToken !== undefined &&
      this.currentToken.type === TokenType.KEYWORD &&
      this.currentToken.value === value
    );
  }

  private skipNewlinesBeforeKeyword(value: string): void {
    const next = this.peekPastNewlines();
    if (next !== undefined && next.type === TokenType.KEYWORD && next.value === value) {
      this.skipNewlines();
    }
  }

  private atNewline(): boolean {
    return this.currentToken !== undefined && this.currentToken.type === TokenType.NEWLINE;
  }

  private skipNewlines(): void {
    while (this.atNewline()) this.advance();
  }

  private advance(): Token | undefined {
    this.tokIdx++;
    this.currentToken = this.tokIdx < this.tokens.length ? this.tokens[this.tokIdx] : undefined;
    return this.currentToken;
  }

  private atom(): Node {
    const tok = this.currentToken;
    if (tok !== undefined && (tok.type === TokenType.INT || tok.type === TokenType.FLOAT)) {
      this.advance();
      return new NumberNode(tok);
    } else if (tok !== undefined && tok.type === TokenType.STRING) {
      this.advance();
      return new StringNode(tok);
    } else if (
      tok !== undefined &&
      tok.type === TokenType.KEYWORD &&
      (tok.value === "true" || tok.value === "false")
    ) {
      this.advance();
      return new BooleanNode(tok);
    } else if (tok !== undefined && tok.type === TokenType.LPAREN) {
      this.advance();
      const innerExpr = this.expr();
      this.expect(TokenType.RPAREN, "Expected ')'");
      return innerExpr;
    } else if (tok !== undefined && tok.type === TokenType.KEYWORD && tok.value === "get") {
      const posStart = tok.posStart;
      this.advance();
      this.expect(TokenType.LPAREN, "Expected '('");
      const propertyTok = this.expect(TokenType.STRING, "Expected a string");
      const closeParen = this.expect(TokenType.RPAREN, "Expected ')'");
      return new GetNode(propertyTok, posStart, closeParen.posEnd);
    } else if (tok !== undefined && tok.type === TokenType.IDENTIFIER) {
      this.advance();
      if (this.currentToken !== undefined && this.currentToken.type === TokenType.DOT) {
        return this.constantExpr(tok);
      }
      if (this.currentToken !== undefined && this.currentToken.type === TokenType.LPAREN) {
        return this.callExpr(tok);
      }
      return new VarAccessNode(tok);
    } else if (tok !== undefined && tok.type === TokenType.KEYWORD && tok.value === "if") {
      return this.ifExpr();
    } else if (tok !== undefined && tok.type === TokenType.KEYWORD && tok.value === "match") {
      return this.matchExpr();
    } else if (
      tok !== undefined &&
      tok.type === TokenType.KEYWORD &&
      (tok.value === "interpolate" ||
        tok.value === "interpolateHcl" ||
        tok.value === "interpolateLab")
    ) {
      return this.interpolateExpr(tok);
    } else if (tok !== undefined && tok.type === TokenType.KEYWORD && tok.value === "step") {
      return this.stepExpr();
    }

    const [posStart, posEnd] = this.errorRange();
    const isEnd = tok === undefined || tok.type === TokenType.EOF;
    const expected =
      "int, float, string, '+', '-', '(', 'get(...)', 'true', 'false', an identifier, 'if', 'match', 'interpolate', 'interpolateHcl', 'interpolateLab', or 'step'";
    throw new InvalidSyntaxError(
      posStart,
      posEnd,
      isEnd
        ? `Unexpected end of input, expected ${expected}`
        : `Unexpected token: ${tok}, expected ${expected}`,
      this.text,
    );
  }

  private power(): Node {
    return this.binOp(
      () => this.atom(),
      [TokenType.POW],
      () => this.factor(),
    );
  }
  private factor(): Node {
    const tok = this.currentToken;
    if (tok !== undefined && (tok.type === TokenType.PLUS || tok.type === TokenType.MINUS)) {
      this.advance();
      const operand = this.factor();
      return new UnaryOpNode(tok, operand);
    }

    return this.power();
  }

  private term(): Node {
    return this.binOp(
      () => this.factor(),
      [TokenType.MUL, TokenType.DIV, TokenType.MOD],
      () => this.factor(),
    );
  }

  private compExpr(): Node {
    const tok = this.currentToken;
    if (tok !== undefined && tok.type === TokenType.KEYWORD && tok.value === "not") {
      this.advance();
      const operand = this.compExpr();
      return new UnaryOpNode(tok, operand);
    }
    return this.binOp(
      () => this.arithExpr(),
      [TokenType.EE, TokenType.NE, TokenType.LT, TokenType.LTE, TokenType.GT, TokenType.GTE],
      () => this.arithExpr(),
    );
  }

  private arithExpr(): Node {
    return this.binOp(
      () => this.term(),
      [TokenType.PLUS, TokenType.MINUS],
      () => this.term(),
    );
  }

  private ifExpr(): Node {
    const ifTok = this.expectKeyword("if", "Expected 'if'");
    const cases: IfCase[] = [];

    const firstCondition = this.expr();
    this.expectKeyword("then", "Expected 'then'");
    this.skipNewlines();
    const firstValue = this.expr();
    cases.push({ condition: firstCondition, value: firstValue });

    this.skipNewlinesBeforeKeyword("elif");
    while (this.isKeyword("elif")) {
      this.advance();
      const condition = this.expr();
      this.expectKeyword("then", "Expected 'then'");
      this.skipNewlines();
      const value = this.expr();
      cases.push({ condition, value });
      this.skipNewlinesBeforeKeyword("elif");
    }

    this.skipNewlinesBeforeKeyword("else");
    this.expectKeyword("else", "Expected 'else'");
    this.skipNewlines();
    const elseCase = this.expr();

    return new IfNode(cases, elseCase, ifTok.posStart);
  }

  private matchExpr(): Node {
    const matchTok = this.expectKeyword("match", "Expected 'match'");
    const input = this.expr();
    this.skipNewlines();

    const cases: MatchCase[] = [];

    const firstLabels = this.matchLabelList(false);
    this.expectKeyword("then", "Expected 'then'");
    this.skipNewlines();
    const firstValue = this.expr();
    cases.push({ labels: firstLabels, value: firstValue });
    this.skipNewlines();

    while (!this.isKeyword("else")) {
      const labels = this.matchLabelList(true);
      this.expectKeyword("then", "Expected 'then'");
      this.skipNewlines();
      const value = this.expr();
      cases.push({ labels, value });
      this.skipNewlines();
    }

    this.expectKeyword("else", "Expected 'else'");
    this.skipNewlines();
    const elseCase = this.expr();

    return new MatchNode(input, cases, elseCase, matchTok.posStart);
  }

  private matchLabelList(elseIsValidHere: boolean): MatchLabel[] {
    const labels: MatchLabel[] = [this.matchLabel(elseIsValidHere)];
    while (this.currentToken !== undefined && this.currentToken.type === TokenType.COMMA) {
      this.advance();
      labels.push(this.matchLabel(false));
    }
    return labels;
  }

  private matchLabel(elseIsValidHere: boolean): MatchLabel {
    const tok = this.currentToken;
    if (tok !== undefined && (tok.type === TokenType.INT || tok.type === TokenType.FLOAT)) {
      this.advance();
      return new NumberNode(tok);
    }
    if (tok !== undefined && tok.type === TokenType.STRING) {
      this.advance();
      return new StringNode(tok);
    }

    const [posStart, posEnd] = this.errorRange();
    const isEnd = tok === undefined || tok.type === TokenType.EOF;
    const expected = elseIsValidHere ? "a number, a string, or 'else'" : "a number or a string";
    throw new InvalidSyntaxError(
      posStart,
      posEnd,
      isEnd
        ? `Unexpected end of input, expected ${expected}`
        : `Unexpected token: ${tok}, expected ${expected}`,
      this.text,
    );
  }

  private constantExpr(namespaceTok: Token): Node {
    this.advance(); // consume DOT -- caller already confirmed it's there
    const memberTok = this.expect(TokenType.IDENTIFIER, "Expected a constant name");
    return new ConstantNode(namespaceTok, memberTok);
  }

  private interpolationType(): InterpolationType {
    const tok = this.currentToken;
    if (tok !== undefined && tok.type === TokenType.IDENTIFIER && tok.value === "linear") {
      this.advance();
      return new LinearInterpolationNode(tok);
    }
    if (tok !== undefined && tok.type === TokenType.IDENTIFIER && tok.value === "exponential") {
      this.advance();
      this.expect(TokenType.LPAREN, "Expected '('");
      const base = this.expr();
      const closeParen = this.expect(TokenType.RPAREN, "Expected ')'");
      return new ExponentialInterpolationNode(base, tok.posStart, closeParen.posEnd);
    }
    if (tok !== undefined && tok.type === TokenType.IDENTIFIER && tok.value === "cubicBezier") {
      this.advance();
      this.expect(TokenType.LPAREN, "Expected '('");
      const x1 = this.expr();
      this.expect(TokenType.COMMA, "Expected ','");
      const y1 = this.expr();
      this.expect(TokenType.COMMA, "Expected ','");
      const x2 = this.expr();
      this.expect(TokenType.COMMA, "Expected ','");
      const y2 = this.expr();
      const closeParen = this.expect(TokenType.RPAREN, "Expected ')'");
      return new CubicBezierInterpolationNode(x1, y1, x2, y2, tok.posStart, closeParen.posEnd);
    }

    const [posStart, posEnd] = this.errorRange();
    const isEnd = tok === undefined || tok.type === TokenType.EOF;
    const expected = "'linear', 'exponential(base)', or 'cubicBezier(x1, y1, x2, y2)'";
    throw new InvalidSyntaxError(
      posStart,
      posEnd,
      isEnd
        ? `Unexpected end of input, expected ${expected}`
        : `Unexpected token: ${tok}, expected ${expected}`,
      this.text,
    );
  }

  private stopInput(): NumberNode {
    const tok = this.currentToken;
    if (tok !== undefined && (tok.type === TokenType.INT || tok.type === TokenType.FLOAT)) {
      this.advance();
      return new NumberNode(tok);
    }

    const [posStart, posEnd] = this.errorRange();
    const isEnd = tok === undefined || tok.type === TokenType.EOF;
    const expected = "a number";
    throw new InvalidSyntaxError(
      posStart,
      posEnd,
      isEnd
        ? `Unexpected end of input, expected ${expected}`
        : `Unexpected token: ${tok}, expected ${expected}`,
      this.text,
    );
  }

  private moreStopsFollow(): boolean {
    let idx = this.tokIdx;
    while (this.tokens[idx]?.type === TokenType.NEWLINE) idx++;
    const numTok = this.tokens[idx];
    if (
      numTok === undefined ||
      (numTok.type !== TokenType.INT && numTok.type !== TokenType.FLOAT)
    ) {
      return false;
    }
    const thenTok = this.tokens[idx + 1];
    return thenTok !== undefined && thenTok.type === TokenType.KEYWORD && thenTok.value === "then";
  }

  private interpolateVariant(tok: Token): "interpolate" | "interpolateHcl" | "interpolateLab" {
    if (tok.value === "interpolateHcl") return "interpolateHcl";
    if (tok.value === "interpolateLab") return "interpolateLab";
    return "interpolate";
  }

  private interpolateExpr(startTok: Token): Node {
    const variant = this.interpolateVariant(startTok);
    const posStart = startTok.posStart;
    this.advance(); // consume the interpolate/interpolateHcl/interpolateLab keyword

    const interpolationType = this.interpolationType();
    const input = this.expr();
    this.skipNewlines();

    const stops: InterpolateStop[] = [];
    const firstInput = this.stopInput();
    this.expectKeyword("then", "Expected 'then'");
    this.skipNewlines();
    const firstValue = this.expr();
    stops.push({ input: firstInput, value: firstValue });

    while (this.moreStopsFollow()) {
      this.skipNewlines();
      const stopInput = this.stopInput();
      this.expectKeyword("then", "Expected 'then'");
      this.skipNewlines();
      const value = this.expr();
      stops.push({ input: stopInput, value });
    }

    return new InterpolateNode(variant, interpolationType, input, stops, posStart);
  }

  private stepExpr(): Node {
    const stepTok = this.expectKeyword("step", "Expected 'step'");
    const input = this.expr();
    this.skipNewlines();
    this.expectKeyword("default", "Expected 'default'");
    const defaultValue = this.expr();
    this.skipNewlines();

    const stops: StepStop[] = [];
    const firstInput = this.stopInput();
    this.expectKeyword("then", "Expected 'then'");
    this.skipNewlines();
    const firstValue = this.expr();
    stops.push({ input: firstInput, value: firstValue });

    while (this.moreStopsFollow()) {
      this.skipNewlines();
      const stopInput = this.stopInput();
      this.expectKeyword("then", "Expected 'then'");
      this.skipNewlines();
      const value = this.expr();
      stops.push({ input: stopInput, value });
    }

    return new StepNode(input, defaultValue, stops, stepTok.posStart);
  }

  private callExpr(nameTok: Token): Node {
    this.advance(); // consume LPAREN -- caller already confirmed it's there
    const args: Node[] = [];

    if (this.currentToken !== undefined && this.currentToken.type !== TokenType.RPAREN) {
      args.push(this.expr());
      while (this.currentToken !== undefined && this.currentToken.type === TokenType.COMMA) {
        this.advance();
        args.push(this.expr());
      }
    }

    const closeParen = this.expect(TokenType.RPAREN, "Expected ')'");
    return new CallNode(nameTok, args, closeParen.posEnd);
  }

  private statement(): Node {
    const tok = this.currentToken;
    if (tok !== undefined && tok.type === TokenType.KEYWORD && tok.value === "var") {
      this.advance();
      const nameTok = this.expect(TokenType.IDENTIFIER, "Expected an identifier");
      this.expect(TokenType.EQ, "Expected '='");
      const valueNode = this.expr();
      return new VarAssignNode(nameTok, valueNode, new VarAccessNode(nameTok));
    }

    return this.expr();
  }

  private expr(): Node {
    return this.binOp(
      () => this.compExpr(),
      [
        [TokenType.KEYWORD, "and"],
        [TokenType.KEYWORD, "or"],
      ],
      () => this.compExpr(),
    );
  }

  private binOp(
    func1: () => Node,
    ops: ([TokenType, string] | TokenType)[],
    func2: () => Node,
  ): Node {
    let left = func1();

    while (
      this.currentToken !== undefined &&
      ops.some((op) => this.matchesOp(this.currentToken, op))
    ) {
      const opToken = this.currentToken;
      this.advance();
      const right = func2();
      left = new BinOpNode(left, opToken, right);
    }

    return left;
  }

  private matchesOp(token: Token | undefined, op: [TokenType, string] | TokenType): boolean {
    if (token === undefined) return false;
    if (Array.isArray(op)) {
      return token.type === op[0] && token.value === op[1];
    }
    return token.type === op;
  }

  private errorRange(): [Position, Position] {
    if (this.currentToken !== undefined) {
      return [this.currentToken.posStart, this.currentToken.posEnd];
    }
    const fallback = this.tokens.at(-1)?.posEnd ?? new Position(0, 0, 0);
    return [fallback, fallback];
  }

  private expect(type: TokenType, message: string): Token {
    const tok = this.currentToken;
    if (tok !== undefined && tok.type === type) {
      this.advance();
      return tok;
    }
    const [posStart, posEnd] = this.errorRange();
    const found = tok === undefined || tok.type === TokenType.EOF ? "end of input" : `${tok}`;
    throw new InvalidSyntaxError(posStart, posEnd, `${message} (got ${found})`, this.text);
  }

  private expectKeyword(value: string, message: string): Token {
    const tok = this.currentToken;
    if (tok !== undefined && tok.type === TokenType.KEYWORD && tok.value === value) {
      this.advance();
      return tok;
    }
    const [posStart, posEnd] = this.errorRange();
    const found = tok === undefined || tok.type === TokenType.EOF ? "end of input" : `${tok}`;
    throw new InvalidSyntaxError(posStart, posEnd, `${message} (got ${found})`, this.text);
  }
}
