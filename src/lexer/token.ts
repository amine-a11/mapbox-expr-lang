import { inspect } from "node:util";
import type { Position } from "../errors/position";

export const DIGITS = "0123456789";

export enum TokenType {
  INT,
  FLOAT,
  PLUS,
  MINUS,
  MUL,
  DIV,
  LPAREN,
  RPAREN,
}

export class Token {
  posStart: Position | undefined;
  posEnd: Position | undefined;

  constructor(
    public type: TokenType,
    public value?: number,
    posStart?: Position,
    posEnd?: Position,
  ) {
    this.posStart = posStart?.copy();
    this.posEnd = posEnd?.copy() ?? this.posStart;
  }

  [inspect.custom](): string {
    const type = TokenType[this.type];
    if (this.value !== undefined) return `${type}:${this.value}`;
    return type;
  }
}
