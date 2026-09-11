import { describe, expect, it } from "vitest";
import { Lexer } from "../src/lexer/lexer";
import { Token, TokenType } from "../src/lexer/token";

function tokenize(source: string) {
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
    const [tokens, error] = tokenize("42");

    expect(error).toBeUndefined();
    expect(simplify(tokens)).toEqual([[TokenType.INT, 42], EOF]);
  });

  it.each([
    ["+", TokenType.PLUS],
    ["-", TokenType.MINUS],
    ["*", TokenType.MUL],
    ["/", TokenType.DIV],
    ["(", TokenType.LPAREN],
    [")", TokenType.RPAREN],
  ] as const)("tokenizes the operator %s", (source, type) => {
    const [tokens, error] = tokenize(source);

    expect(error).toBeUndefined();
    expect(simplify(tokens)).toEqual([[type, undefined], EOF]);
  });

  it("tokenizes a full arithmetic expression", () => {
    const [tokens, error] = tokenize("1 + 2 * (3 - 4)");

    expect(error).toBeUndefined();
    expect(simplify(tokens)).toEqual([
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
    const [tokens, error] = tokenize("3.14");

    expect(error).toBeUndefined();
    expect(simplify(tokens)).toEqual([[TokenType.FLOAT, 3.14], EOF]);
  });

  it("keeps a falsy numeric value like 0 (regression)", () => {
    const [tokens, error] = tokenize("0");

    expect(error).toBeUndefined();
    expect(simplify(tokens)).toEqual([[TokenType.INT, 0], EOF]);
  });

  it("ignores whitespace between tokens", () => {
    const [tokens, error] = tokenize("  1   +   2  ");

    expect(error).toBeUndefined();
    expect(simplify(tokens)).toEqual([
      [TokenType.INT, 1],
      [TokenType.PLUS, undefined],
      [TokenType.INT, 2],
      EOF,
    ]);
  });

  it("reports an illegal character and no tokens", () => {
    const [tokens, error] = tokenize("@");

    expect(tokens).toEqual([]);
    expect(error).toBeDefined();
    expect(error?.name).toBe("Illegal Character");
    expect(error?.message).toBe("'@'");
  });

  it("returns just an EOF token and no error for empty input", () => {
    const [tokens, error] = tokenize("");

    expect(error).toBeUndefined();
    expect(simplify(tokens)).toEqual([EOF]);
  });

  it("stops a number at a second decimal point", () => {
    const [tokens, error] = tokenize("1.2.3");

    // Current behavior: lexes 1.2 as a float, then errors on the stray
    // second '.'. If this is ever changed on purpose, update this test.
    expect(tokens).toEqual([]);
    expect(error).toBeDefined();
    expect(error?.name).toBe("Illegal Character");
    expect(error?.message).toBe("'.'");
  });

  it("tracks the source position of a token", () => {
    const [tokens, error] = tokenize("42");

    expect(error).toBeUndefined();
    expect(tokens[0]?.posStart).toMatchObject({ idx: 0, ln: 0, col: 0 });
    expect(tokens[0]?.posEnd).toMatchObject({ idx: 2, ln: 0, col: 2 });
  });
});
