import type { Position } from "./position";

export class LangError extends Error {
  constructor(
    name: string,
    public posStart: Position,
    public posEnd: Position,
    message: string,
  ) {
    super(message);
    this.name = name;
  }
}

export class IllegalCharError extends LangError {
  constructor(posStart: Position, posEnd: Position, char: string) {
    super("Illegal Character", posStart, posEnd, `'${char}'`);
  }
}
