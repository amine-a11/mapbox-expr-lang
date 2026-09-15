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
  MOD,
  LPAREN,
  RPAREN,
  EOF,
}

export class Token {
  posStart: Position;
  posEnd: Position;

  constructor(
    public type: TokenType,
    public value: number | undefined,
    posStart: Position,
    posEnd: Position,
  ) {
    this.posStart = posStart.copy();
    this.posEnd = posEnd.copy();
  }

  toString(): string {
    const type = TokenType[this.type];
    if (this.value !== undefined) return `${type}:${this.value}`;
    return type;
  }

  [inspect.custom](): string {
    return this.toString();
  }
}
