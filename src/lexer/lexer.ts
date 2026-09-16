import { TokenType, Token, DIGITS, LETTERS, LETTERS_DIGITS, KEYWORDS } from "./token";
import { ExpectedCharError, IllegalCharError, UnterminatedStringError } from "../errors/langError";
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

  makeToken(): Token[] {
    const tokens: Token[] = [];
    while (this.currentChar !== undefined) {
      if (this.currentChar === " " || this.currentChar === "\t" || this.currentChar === "\r") {
        this.advance();
      } else if (this.currentChar === "\n") {
        const posStart = this.pos.copy();
        this.advance();
        tokens.push(new Token(TokenType.NEWLINE, undefined, posStart, this.pos));
      } else if (DIGITS.includes(this.currentChar)) {
        tokens.push(this.makeNumber());
      } else if (LETTERS.includes(this.currentChar)) {
        tokens.push(this.makeIdentifier());
      } else if (this.currentChar === "'" || this.currentChar === '"') {
        tokens.push(this.makeString());
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
      } else if (this.currentChar === "%") {
        const posStart = this.pos.copy();
        this.advance();
        tokens.push(new Token(TokenType.MOD, undefined, posStart, this.pos));
      } else if (this.currentChar === "^") {
        const posStart = this.pos.copy();
        this.advance();
        tokens.push(new Token(TokenType.POW, undefined, posStart, this.pos));
      } else if (this.currentChar === "(") {
        const posStart = this.pos.copy();
        this.advance();
        tokens.push(new Token(TokenType.LPAREN, undefined, posStart, this.pos));
      } else if (this.currentChar === ")") {
        const posStart = this.pos.copy();
        this.advance();
        tokens.push(new Token(TokenType.RPAREN, undefined, posStart, this.pos));
      } else if (this.currentChar === "!") {
        tokens.push(this.makeNotEquals());
      } else if (this.currentChar === "=") {
        tokens.push(this.makeEquals());
      } else if (this.currentChar === ">") {
        tokens.push(this.makeGreaterThan());
      } else if (this.currentChar === "<") {
        tokens.push(this.makeLessThan());
      } else {
        const posStart = this.pos.copy();
        const char = this.currentChar;
        this.advance();
        throw new IllegalCharError(posStart, this.pos, char, this.text);
      }
    }
    tokens.push(new Token(TokenType.EOF, undefined, this.pos, this.pos));
    return tokens;
  }

  makeNotEquals(): Token {
    const posStart = this.pos.copy();
    this.advance();

    if (this.currentChar === "=") {
      this.advance();
      return new Token(TokenType.NE, undefined, posStart, this.pos);
    }
    throw new ExpectedCharError(posStart, this.pos, "Expected '=' after '!'", this.text);
  }

  makeEquals(): Token {
    const posStart = this.pos.copy();
    this.advance();

    if (this.currentChar === "=") {
      this.advance();
      return new Token(TokenType.EE, undefined, posStart, this.pos);
    }
    return new Token(TokenType.EQ, undefined, posStart, this.pos);
  }

  makeGreaterThan(): Token {
    const posStart = this.pos.copy();
    this.advance();

    if (this.currentChar === "=") {
      this.advance();
      return new Token(TokenType.GTE, undefined, posStart, this.pos);
    }
    return new Token(TokenType.GT, undefined, posStart, this.pos);
  }
  makeLessThan(): Token {
    const posStart = this.pos.copy();
    this.advance();

    if (this.currentChar === "=") {
      this.advance();
      return new Token(TokenType.LTE, undefined, posStart, this.pos);
    }
    return new Token(TokenType.LT, undefined, posStart, this.pos);
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

  makeIdentifier(): Token {
    let value: string = "";
    const posStart = this.pos.copy();
    while (this.currentChar !== undefined && (LETTERS_DIGITS + "_").includes(this.currentChar)) {
      value += this.currentChar;
      this.advance();
    }
    const tokType = KEYWORDS.includes(value) ? TokenType.KEYWORD : TokenType.IDENTIFIER;
    return new Token(tokType, value, posStart, this.pos);
  }

  makeString(): Token {
    const quote = this.currentChar;
    const posStart = this.pos.copy();
    this.advance(); // consume the opening quote

    let value = "";
    while (this.currentChar !== undefined && this.currentChar !== quote) {
      value += this.currentChar;
      this.advance();
    }

    if (this.currentChar === undefined) {
      // Ran out of input before finding the closing quote.
      throw new UnterminatedStringError(posStart, this.pos, this.text);
    }

    this.advance(); // consume the closing quote
    return new Token(TokenType.STRING, value, posStart, this.pos);
  }
}
