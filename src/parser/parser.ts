import { TokenType, type Token } from "../lexer/token";
import { InvalidSyntaxError } from "../errors/langError";
import { Position } from "../errors/position";
import { BinOpNode, BooleanNode, GetNode, NumberNode, UnaryOpNode, type Node } from "./nodes";

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
    const node = this.expr();

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
    }

    const [posStart, posEnd] = this.errorRange();
    const isEnd = tok === undefined || tok.type === TokenType.EOF;
    const expected = "int, float, '+', '-', '(', 'get(...)', 'true' or 'false'";
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
}
