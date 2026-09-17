import type { Position } from "../errors/position";

const NODE_INSPECT_CUSTOM = Symbol.for("nodejs.util.inspect.custom");

export const DIGITS = "0123456789";
export const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const LETTERS_DIGITS = LETTERS + DIGITS;
export const KEYWORDS = [
  "var",
  "get",
  "and",
  "or",
  "not",
  "if",
  "elif",
  "else",
  "then",
  "match",
  "true",
  "false",
  "interpolate",
  "interpolateHcl",
  "interpolateLab",
  "step",
  "default",
];
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
  EQ, // =
  EE, // ==
  NE, // !=
  LT, // <
  GT, // >
  LTE, // <=
  GTE, // >=
  LPAREN,
  RPAREN,
  COMMA,
  DOT,
  NEWLINE,
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

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}
