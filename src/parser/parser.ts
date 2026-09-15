import { TokenType, type Token } from "../lexer/token";
import { InvalidSyntaxError } from "../errors/langError";
import { Position } from "../errors/position";
import { BinOpNode, NumberNode, UnaryOpNode, type Node } from "./nodes";

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

    // expr() stops as soon as it can't extend the expression further --
    // if we're not sitting on EOF at that point, there's leftover input
    // the grammar doesn't account for (e.g. "1 + 2 3").
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

  private factor(): Node {
    const tok = this.currentToken;
    if (tok !== undefined && (tok.type === TokenType.PLUS || tok.type === TokenType.MINUS)) {
      this.advance();
      const operand = this.factor();
      return new UnaryOpNode(tok, operand);
    } else if (tok !== undefined && (tok.type === TokenType.INT || tok.type === TokenType.FLOAT)) {
      this.advance();
      return new NumberNode(tok);
    } else if (tok !== undefined && tok.type === TokenType.LPAREN) {
      this.advance();
      const innerExpr = this.expr();
      if (this.currentToken !== undefined && this.currentToken.type === TokenType.RPAREN) {
        this.advance();
        return innerExpr;
      } else {
        const [posStart, posEnd] = this.errorRange();
        throw new InvalidSyntaxError(posStart, posEnd, "Expected ')'", this.text);
      }
    }

    const [posStart, posEnd] = this.errorRange();
    const isEnd = tok === undefined || tok.type === TokenType.EOF;
    throw new InvalidSyntaxError(
      posStart,
      posEnd,
      isEnd ? "Unexpected end of input" : `Unexpected token: ${tok}`,
      this.text,
    );
  }

  private term(): Node {
    return this.binOp(() => this.factor(), [TokenType.MUL, TokenType.DIV, TokenType.MOD]);
  }

  private expr(): Node {
    return this.binOp(() => this.term(), [TokenType.PLUS, TokenType.MINUS]);
  }

  private binOp(func: () => Node, ops: TokenType[]): Node {
    let left = func();

    while (this.currentToken !== undefined && ops.includes(this.currentToken.type)) {
      const opToken = this.currentToken;
      this.advance();
      const right = func();
      left = new BinOpNode(left, opToken, right);
    }

    return left;
  }

  private errorRange(): [Position, Position] {
    if (this.currentToken !== undefined) {
      return [this.currentToken.posStart, this.currentToken.posEnd];
    }
    const fallback = this.tokens.at(-1)?.posEnd ?? new Position(0, 0, 0);
    return [fallback, fallback];
  }
}
