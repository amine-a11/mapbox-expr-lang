import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Token, TokenType } from "../../src/lexer/token";
import { IllegalCharError, UnterminatedStringError } from "../../src/errors/langError";

function tokenize(source: string): Token[] {
  return new Lexer(source).makeToken();
}

// Positions differ per input, so most tests only care about the
// (type, value) pairs, not the exact source position of each token.
function simplify(tokens: Token[]): [TokenType, number | string | undefined][] {
  return tokens.map((t) => [t.type, t.value]);
}

// makeToken() always appends an EOF token on success, so every
// "successful tokenize" expectation ends with this.
const EOF = [TokenType.EOF, undefined] as const;

describe("Lexer literals", () => {
  describe("numbers", () => {
    it("tokenizes a single integer", () => {
      expect(simplify(tokenize("42"))).toEqual([[TokenType.INT, 42], EOF]);
    });

    it("tokenizes a float", () => {
      expect(simplify(tokenize("3.14"))).toEqual([[TokenType.FLOAT, 3.14], EOF]);
    });

    it("keeps a falsy numeric value like 0 (regression)", () => {
      expect(simplify(tokenize("0"))).toEqual([[TokenType.INT, 0], EOF]);
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

  describe("strings", () => {
    it("tokenizes a double-quoted string", () => {
      expect(simplify(tokenize('"population"'))).toEqual([[TokenType.STRING, "population"], EOF]);
    });

    it("tokenizes a single-quoted string", () => {
      expect(simplify(tokenize("'population'"))).toEqual([[TokenType.STRING, "population"], EOF]);
    });

    it("preserves characters that aren't valid in a bare identifier", () => {
      // The whole reason property names need to be strings, not bare
      // identifiers: real Mapbox/OSM property names often look like this.
      expect(simplify(tokenize('"name:en"'))).toEqual([[TokenType.STRING, "name:en"], EOF]);
      expect(simplify(tokenize('"population-density"'))).toEqual([
        [TokenType.STRING, "population-density"],
        EOF,
      ]);
    });

    it("tokenizes an empty string", () => {
      expect(simplify(tokenize('""'))).toEqual([[TokenType.STRING, ""], EOF]);
    });

    it("throws on an unterminated string", () => {
      expect(() => tokenize('"population')).toThrow(UnterminatedStringError);
    });
  });

  describe("booleans", () => {
    it("recognizes 'true' and 'false' as keywords, not plain identifiers", () => {
      expect(simplify(tokenize("true"))).toEqual([[TokenType.KEYWORD, "true"], EOF]);
      expect(simplify(tokenize("false"))).toEqual([[TokenType.KEYWORD, "false"], EOF]);
    });
  });

  it("returns just an EOF token for empty input", () => {
    expect(simplify(tokenize(""))).toEqual([EOF]);
  });
});
