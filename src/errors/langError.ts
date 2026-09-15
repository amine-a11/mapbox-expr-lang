import type { Position } from "./position";
import { stringWithArrows } from "./stringWithArrows";

export class LangError extends Error {
  constructor(
    name: string,
    public posStart: Position,
    public posEnd: Position,
    message: string,
    public text: string,
  ) {
    super(message);
    this.name = name;
  }

  override toString(): string {
    return [
      `${this.name}: ${this.message}`,
      `  at line ${this.posStart.ln + 1}, column ${this.posStart.col + 1}`,
      "",
      stringWithArrows(this.text, this.posStart, this.posEnd),
    ].join("\n");
  }
}

export class IllegalCharError extends LangError {
  constructor(posStart: Position, posEnd: Position, char: string, text: string) {
    super("Illegal Character", posStart, posEnd, `'${char}'`, text);
  }
}

export class InvalidSyntaxError extends LangError {
  constructor(posStart: Position, posEnd: Position, details: string, text: string) {
    super("Invalid Syntax", posStart, posEnd, details, text);
  }
}

export class RuntimeError extends LangError {
  constructor(posStart: Position, posEnd: Position, details: string, text: string) {
    super("Runtime Error", posStart, posEnd, details, text);
  }
}

export class UnterminatedStringError extends LangError {
  constructor(posStart: Position, posEnd: Position, text: string) {
    super("Unterminated String", posStart, posEnd, "Expected a closing quote", text);
  }
}
