import { describe, expect, it } from "vitest";
import { Lexer } from "../src/lexer/lexer";
import { Token, TokenType } from "../src/lexer/token";
import { IllegalCharError } from "../src/errors/langError";

function tokenize(source: string): Token[] {
  return new Lexer(source).makeToken();
}

// Positions differ per input, so most tests only care about the
// (type, value) pairs, not the exact source position of each token.
function simplify(tokens: Token[]): [TokenType, number | undefined][] {
  return tokens.map((t) => [t.type, t.value]);
}

// makeToken() always appends an EOF token on success, so every
// "successful tokenize" expectation ends with this.
const EOF = [TokenType.EOF, undefined] as const;

describe("Lexer", () => {
  it("tokenizes a single integer", () => {
    expect(simplify(tokenize("42"))).toEqual([[TokenType.INT, 42], EOF]);
  });

  it.each([
    ["+", TokenType.PLUS],
    ["-", TokenType.MINUS],
    ["*", TokenType.MUL],
    ["/", TokenType.DIV],
    ["(", TokenType.LPAREN],
    [")", TokenType.RPAREN],
  ] as const)("tokenizes the operator %s", (source, type) => {
    expect(simplify(tokenize(source))).toEqual([[type, undefined], EOF]);
  });

  it("tokenizes a full arithmetic expression", () => {
    expect(simplify(tokenize("1 + 2 * (3 - 4)"))).toEqual([
      [TokenType.INT, 1],
      [TokenType.PLUS, undefined],
      [TokenType.INT, 2],
      [TokenType.MUL, undefined],
      [TokenType.LPAREN, undefined],
      [TokenType.INT, 3],
      [TokenType.MINUS, undefined],
      [TokenType.INT, 4],
      [TokenType.RPAREN, undefined],
      EOF,
    ]);
  });

  it("tokenizes a float", () => {
    expect(simplify(tokenize("3.14"))).toEqual([[TokenType.FLOAT, 3.14], EOF]);
  });

  it("keeps a falsy numeric value like 0 (regression)", () => {
    expect(simplify(tokenize("0"))).toEqual([[TokenType.INT, 0], EOF]);
  });

  it("ignores whitespace between tokens", () => {
    expect(simplify(tokenize("  1   +   2  "))).toEqual([
      [TokenType.INT, 1],
      [TokenType.PLUS, undefined],
      [TokenType.INT, 2],
      EOF,
    ]);
  });

  it("throws an illegal character error", () => {
    expect(() => tokenize("@")).toThrow(IllegalCharError);
    expect(() => tokenize("@")).toThrow("'@'");
  });

  it("returns just an EOF token for empty input", () => {
    expect(simplify(tokenize(""))).toEqual([EOF]);
  });

  it("stops a number at a second decimal point", () => {
    // Current behavior: lexes 1.2 as a float, then errors on the stray
    // second '.'. If this is ever changed on purpose, update this test.
    expect(() => tokenize("1.2.3")).toThrow(IllegalCharError);
    expect(() => tokenize("1.2.3")).toThrow("'.'");
  });

  it("tracks the source position of a token", () => {
    const tokens = tokenize("42");
    expect(tokens[0]?.posStart).toMatchObject({ idx: 0, ln: 0, col: 0 });
    expect(tokens[0]?.posEnd).toMatchObject({ idx: 2, ln: 0, col: 2 });
  });
});
