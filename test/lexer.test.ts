import { describe, expect, it } from "vitest";
import { Lexer } from "../src/lexer/lexer";
import { Token, TokenType } from "../src/lexer/token";
import {
  ExpectedCharError,
  IllegalCharError,
  UnterminatedStringError,
} from "../src/errors/langError";

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

describe("Lexer", () => {
  it("tokenizes a single integer", () => {
    expect(simplify(tokenize("42"))).toEqual([[TokenType.INT, 42], EOF]);
  });

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

  describe("newlines", () => {
    it("tokenizes a bare LF as NEWLINE", () => {
      expect(simplify(tokenize("1\n2"))).toEqual([
        [TokenType.INT, 1],
        [TokenType.NEWLINE, undefined],
        [TokenType.INT, 2],
        EOF,
      ]);
    });

    it("tokenizes a CRLF as exactly one NEWLINE, not two tokens", () => {
      expect(simplify(tokenize("1\r\n2"))).toEqual([
        [TokenType.INT, 1],
        [TokenType.NEWLINE, undefined],
        [TokenType.INT, 2],
        EOF,
      ]);
    });

    it("produces one NEWLINE token per line break, even for consecutive blank lines", () => {
      expect(simplify(tokenize("1\n\n\n2"))).toEqual([
        [TokenType.INT, 1],
        [TokenType.NEWLINE, undefined],
        [TokenType.NEWLINE, undefined],
        [TokenType.NEWLINE, undefined],
        [TokenType.INT, 2],
        EOF,
      ]);
    });

    it("tracks line and column across a newline", () => {
      const tokens = tokenize("1\n2");
      expect(tokens[2]?.posStart).toMatchObject({ idx: 2, ln: 1, col: 0 });
    });
  });

  describe("identifiers and keywords", () => {
    it("tokenizes a plain identifier", () => {
      expect(simplify(tokenize("population"))).toEqual([[TokenType.IDENTIFIER, "population"], EOF]);
    });

    it("recognizes 'get' as a keyword, not a plain identifier", () => {
      expect(simplify(tokenize("get"))).toEqual([[TokenType.KEYWORD, "get"], EOF]);
    });

    it("recognizes 'var' as a keyword, not a plain identifier", () => {
      expect(simplify(tokenize("var"))).toEqual([[TokenType.KEYWORD, "var"], EOF]);
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

    it("allows digits and underscores after the first letter", () => {
      expect(simplify(tokenize("road_type2"))).toEqual([[TokenType.IDENTIFIER, "road_type2"], EOF]);
    });
  });

  describe("string literals", () => {
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

    it("tokenizes a full get() call", () => {
      expect(simplify(tokenize('get("population")'))).toEqual([
        [TokenType.KEYWORD, "get"],
        [TokenType.LPAREN, undefined],
        [TokenType.STRING, "population"],
        [TokenType.RPAREN, undefined],
        EOF,
      ]);
    });
  });

  describe("comparison and logical operators", () => {
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

    it("recognizes 'and', 'or', and 'not' as keywords, not plain identifiers", () => {
      expect(simplify(tokenize("and"))).toEqual([[TokenType.KEYWORD, "and"], EOF]);
      expect(simplify(tokenize("or"))).toEqual([[TokenType.KEYWORD, "or"], EOF]);
      expect(simplify(tokenize("not"))).toEqual([[TokenType.KEYWORD, "not"], EOF]);
    });

    it("recognizes 'true' and 'false' as keywords, not plain identifiers", () => {
      expect(simplify(tokenize("true"))).toEqual([[TokenType.KEYWORD, "true"], EOF]);
      expect(simplify(tokenize("false"))).toEqual([[TokenType.KEYWORD, "false"], EOF]);
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
});
