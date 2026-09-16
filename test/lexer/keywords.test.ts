import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Token, TokenType } from "../../src/lexer/token";

function tokenize(source: string): Token[] {
  return new Lexer(source).makeToken();
}

function simplify(tokens: Token[]): [TokenType, number | string | undefined][] {
  return tokens.map((t) => [t.type, t.value]);
}

const EOF = [TokenType.EOF, undefined] as const;

describe("Lexer identifiers and keywords", () => {
  it("tokenizes a plain identifier", () => {
    expect(simplify(tokenize("population"))).toEqual([[TokenType.IDENTIFIER, "population"], EOF]);
  });

  it("allows digits and underscores after the first letter", () => {
    expect(simplify(tokenize("road_type2"))).toEqual([[TokenType.IDENTIFIER, "road_type2"], EOF]);
  });

  it.each([
    "get",
    "var",
    "if",
    "then",
    "elif",
    "else",
    "match",
    "and",
    "or",
    "not",
    "true",
    "false",
  ])("recognizes '%s' as a keyword, not a plain identifier", (word) => {
    expect(simplify(tokenize(word))).toEqual([[TokenType.KEYWORD, word], EOF]);
  });

  it("tokenizes a full variable assignment", () => {
    expect(simplify(tokenize("var a = 5"))).toEqual([
      [TokenType.KEYWORD, "var"],
      [TokenType.IDENTIFIER, "a"],
      [TokenType.EQ, undefined],
      [TokenType.INT, 5],
      EOF,
    ]);
  });

  it("tokenizes a full get() call", () => {
    expect(simplify(tokenize('get("population")'))).toEqual([
      [TokenType.KEYWORD, "get"],
      [TokenType.LPAREN, undefined],
      [TokenType.STRING, "population"],
      [TokenType.RPAREN, undefined],
      EOF,
    ]);
  });

  it("tokenizes a full if/then/elif/else expression", () => {
    expect(simplify(tokenize("if a then 1 elif b then 2 else 3"))).toEqual([
      [TokenType.KEYWORD, "if"],
      [TokenType.IDENTIFIER, "a"],
      [TokenType.KEYWORD, "then"],
      [TokenType.INT, 1],
      [TokenType.KEYWORD, "elif"],
      [TokenType.IDENTIFIER, "b"],
      [TokenType.KEYWORD, "then"],
      [TokenType.INT, 2],
      [TokenType.KEYWORD, "else"],
      [TokenType.INT, 3],
      EOF,
    ]);
  });

  it("tokenizes a full match expression with a label list", () => {
    expect(simplify(tokenize('match a "x", "y" then 1 else 2'))).toEqual([
      [TokenType.KEYWORD, "match"],
      [TokenType.IDENTIFIER, "a"],
      [TokenType.STRING, "x"],
      [TokenType.COMMA, undefined],
      [TokenType.STRING, "y"],
      [TokenType.KEYWORD, "then"],
      [TokenType.INT, 1],
      [TokenType.KEYWORD, "else"],
      [TokenType.INT, 2],
      EOF,
    ]);
  });
});
