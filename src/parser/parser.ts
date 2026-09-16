import { TokenType, type Token } from "../lexer/token";
import { InvalidSyntaxError } from "../errors/langError";
import { Position } from "../errors/position";
import {
  BinOpNode,
  BooleanNode,
  GetNode,
  IfNode,
  NumberNode,
  UnaryOpNode,
  VarAccessNode,
  VarAssignNode,
  type IfCase,
  type Node,
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
      return new VarAccessNode(tok);
    } else if (tok !== undefined && tok.type === TokenType.KEYWORD && tok.value === "if") {
      return this.ifExpr();
    }

    const [posStart, posEnd] = this.errorRange();
    const isEnd = tok === undefined || tok.type === TokenType.EOF;
    const expected =
      "int, float, '+', '-', '(', 'get(...)', 'true', 'false', an identifier, or 'if'";
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
