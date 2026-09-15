import { inspect } from "node:util";
import type { Position } from "../errors/position";

export const DIGITS = "0123456789";
export const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const LETTERS_DIGITS = LETTERS + DIGITS;
export const KEYWORDS = ["get"];
export enum TokenType {
  INT,
  FLOAT,
  STRING,
  IDENTIFIER,
  KEYWORD,
  PLUS,
  MINUS,
  MUL,
  DIV,
  MOD,
  POW,
  LPAREN,
  RPAREN,
  EOF,
}

export class Token {
  posStart: Position;
  posEnd: Position;

  constructor(
    public type: TokenType,
    public value: number | string | undefined,
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
