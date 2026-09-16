import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Token, TokenType } from "../../src/lexer/token";
import { ExpectedCharError } from "../../src/errors/langError";

function tokenize(source: string): Token[] {
  return new Lexer(source).makeToken();
}

function simplify(tokens: Token[]): [TokenType, number | string | undefined][] {
  return tokens.map((t) => [t.type, t.value]);
}

const EOF = [TokenType.EOF, undefined] as const;

describe("Lexer operators", () => {
  it.each([
    ["+", TokenType.PLUS],
    ["-", TokenType.MINUS],
    ["*", TokenType.MUL],
    ["/", TokenType.DIV],
    ["%", TokenType.MOD],
    ["^", TokenType.POW],
    ["(", TokenType.LPAREN],
    [")", TokenType.RPAREN],
  ] as const)("tokenizes the operator %s", (source, type) => {
    expect(simplify(tokenize(source))).toEqual([[type, undefined], EOF]);
  });

  it("tokenizes a comma", () => {
    expect(simplify(tokenize(","))).toEqual([[TokenType.COMMA, undefined], EOF]);
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

  it("ignores whitespace between tokens", () => {
    expect(simplify(tokenize("  1   +   2  "))).toEqual([
      [TokenType.INT, 1],
      [TokenType.PLUS, undefined],
      [TokenType.INT, 2],
      EOF,
    ]);
  });

  describe("comparison operators", () => {
    it.each([
      ["==", TokenType.EE],
      ["!=", TokenType.NE],
      ["<", TokenType.LT],
      ["<=", TokenType.LTE],
      [">", TokenType.GT],
      [">=", TokenType.GTE],
    ] as const)("tokenizes %s", (source, type) => {
      expect(simplify(tokenize(source))).toEqual([[type, undefined], EOF]);
    });

    it("throws on a bare '!' -- negation is spelled 'not', not '!'", () => {
      expect(() => tokenize("!")).toThrow(ExpectedCharError);
      expect(() => tokenize("a ! b")).toThrow(ExpectedCharError);
    });

    it("still recognizes '!=' even though bare '!' is invalid on its own", () => {
      expect(simplify(tokenize("a != b"))).toEqual([
        [TokenType.IDENTIFIER, "a"],
        [TokenType.NE, undefined],
        [TokenType.IDENTIFIER, "b"],
        EOF,
      ]);
    });

    it("does not confuse < or > with their -or-equal forms", () => {
      expect(simplify(tokenize("a < b"))).toEqual([
        [TokenType.IDENTIFIER, "a"],
        [TokenType.LT, undefined],
        [TokenType.IDENTIFIER, "b"],
        EOF,
      ]);
      expect(simplify(tokenize("a > b"))).toEqual([
        [TokenType.IDENTIFIER, "a"],
        [TokenType.GT, undefined],
        [TokenType.IDENTIFIER, "b"],
        EOF,
      ]);
    });

    it("tokenizes a bare '=' as EQ, distinct from '==' (EE)", () => {
      expect(simplify(tokenize("="))).toEqual([[TokenType.EQ, undefined], EOF]);
      expect(simplify(tokenize("=="))).toEqual([[TokenType.EE, undefined], EOF]);
    });

    it("tokenizes a full comparison expression", () => {
      expect(simplify(tokenize('get("speed") >= 100'))).toEqual([
        [TokenType.KEYWORD, "get"],
        [TokenType.LPAREN, undefined],
        [TokenType.STRING, "speed"],
        [TokenType.RPAREN, undefined],
        [TokenType.GTE, undefined],
        [TokenType.INT, 100],
        EOF,
      ]);
    });
  });

  it("throws an illegal character error", () => {
    expect(() => tokenize("@")).toThrow("'@'");
  });
});
