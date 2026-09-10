import { TokenType, Token, DIGITS } from "./token";
import { LangError, IllegalCharError } from "../errors/langError";
import { Position } from "../errors/position";

export class Lexer {
  pos: Position;
  currentChar: string | undefined;

  constructor(public text: string) {
    this.pos = new Position(-1, 0, -1);
    this.currentChar = undefined;
    this.advance();
  }

  advance(): void {
    this.pos.advance(this.currentChar);
    this.currentChar = this.pos.idx < this.text.length ? this.text[this.pos.idx] : undefined;
  }

  makeToken(): [Token[], LangError | undefined] {
    const tokens: Token[] = [];
    while (this.currentChar !== undefined) {
      if (this.currentChar === " " || this.currentChar === "\t") {
        this.advance();
      } else if (DIGITS.includes(this.currentChar)) {
        tokens.push(this.makeNumber());
      } else if (this.currentChar === "+") {
        const posStart = this.pos.copy();
        this.advance();
        tokens.push(new Token(TokenType.PLUS, undefined, posStart, this.pos));
      } else if (this.currentChar === "-") {
        const posStart = this.pos.copy();
        this.advance();
        tokens.push(new Token(TokenType.MINUS, undefined, posStart, this.pos));
      } else if (this.currentChar === "*") {
        const posStart = this.pos.copy();
        this.advance();
        tokens.push(new Token(TokenType.MUL, undefined, posStart, this.pos));
      } else if (this.currentChar === "/") {
        const posStart = this.pos.copy();
        this.advance();
        tokens.push(new Token(TokenType.DIV, undefined, posStart, this.pos));
      } else if (this.currentChar === "(") {
        const posStart = this.pos.copy();
        this.advance();
        tokens.push(new Token(TokenType.LPAREN, undefined, posStart, this.pos));
      } else if (this.currentChar === ")") {
        const posStart = this.pos.copy();
        this.advance();
        tokens.push(new Token(TokenType.RPAREN, undefined, posStart, this.pos));
      } else {
        const posStart = this.pos.copy();
        const char = this.currentChar;
        this.advance();
        return [[], new IllegalCharError(posStart, this.pos, char)];
      }
    }
    return [tokens, undefined];
  }

  makeNumber(): Token {
    const posStart = this.pos.copy();
    let num = "";
    let dotCount = 0;
    while (
      this.currentChar !== undefined &&
      (DIGITS.includes(this.currentChar) || this.currentChar === ".")
    ) {
      if (this.currentChar === ".") {
        if (dotCount === 1) break;
        dotCount++;
        num += this.currentChar;
      } else {
        num += this.currentChar;
      }
      this.advance();
    }
    if (dotCount === 0) {
      return new Token(TokenType.INT, parseInt(num, 10), posStart, this.pos);
    }
    return new Token(TokenType.FLOAT, parseFloat(num), posStart, this.pos);
  }
}
