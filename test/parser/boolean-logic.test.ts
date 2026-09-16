import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import type { Node } from "../../src/parser/nodes";

function parse(source: string): Node {
  const tokens = new Lexer(source).makeToken();
  return new Parser(tokens, source).parse();
}

function ast(source: string): string {
  return `${parse(source)}`;
}

describe("Parser boolean logic (and/or/not)", () => {
  it("parses 'and'/'or' as equal-precedence, left-associative operators", () => {
    expect(ast("1 and 2")).toBe("(INT:1, KEYWORD:and, INT:2)");
    expect(ast("1 or 2")).toBe("(INT:1, KEYWORD:or, INT:2)");
    expect(ast("1 and 2 or 3")).toBe("((INT:1, KEYWORD:and, INT:2), KEYWORD:or, INT:3)");
  });

  it("parses 'not' as a prefix operator, chainable without collapsing", () => {
    expect(ast("not 1")).toBe("(KEYWORD:not, INT:1)");
    expect(ast("not not 1")).toBe("(KEYWORD:not, (KEYWORD:not, INT:1))");
  });

  it("combines comparisons and boolean logic across precedence levels", () => {
    expect(ast("1 == 2 and 3 < 4")).toBe("((INT:1, EE, INT:2), KEYWORD:and, (INT:3, LT, INT:4))");
  });

  describe("errors", () => {
    it("throws on a dangling comparison operator", () => {
      expect(() => parse("1 ==")).toThrow("Unexpected end of input");
    });

    it("throws when a comparison's right side can't start with the current token", () => {
      expect(() => parse("1 == )")).toThrow("Unexpected token: RPAREN");
    });

    it("throws on a dangling 'and' or 'or'", () => {
      expect(() => parse("1 and")).toThrow("Unexpected end of input");
      expect(() => parse("1 or")).toThrow("Unexpected end of input");
    });

    it("throws on a dangling 'not'", () => {
      expect(() => parse("not")).toThrow("Unexpected end of input");
    });

    it("throws when 'not's operand can't start with the current token", () => {
      expect(() => parse("not )")).toThrow("Unexpected token: RPAREN");
    });
  });
});
