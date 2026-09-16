import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { GetNode, type Node } from "../../src/parser/nodes";

function parse(source: string): Node {
  const tokens = new Lexer(source).makeToken();
  return new Parser(tokens, source).parse();
}

function ast(source: string): string {
  return `${parse(source)}`;
}

describe("Parser get()", () => {
  it("parses a bare get() call", () => {
    expect(ast('get("population")')).toBe("GET:population");
  });

  it("combines with arithmetic and comparisons like any other atom", () => {
    expect(ast('get("population") + 1')).toBe("(GET:population, PLUS, INT:1)");
    expect(ast('get("speed") >= 100')).toBe("(GET:speed, GTE, INT:100)");
  });

  it("builds a GetNode wrapping the property token", () => {
    const node = parse('get("population")');
    expect(node).toBeInstanceOf(GetNode);
    if (node instanceof GetNode) {
      expect(node.tok.value).toBe("population");
    }
  });

  it("mentions get(...) as a valid way to start an atom", () => {
    // Regression: this list went stale once already when get() was
    // added but this message wasn't updated to mention it.
    expect(() => parse("*3")).toThrow("'get(...)'");
  });

  describe("errors", () => {
    it("throws when '(' is missing", () => {
      expect(() => parse("get")).toThrow("Expected '(' (got end of input)");
    });

    it("throws when the argument isn't a string", () => {
      expect(() => parse("get(1)")).toThrow("Expected a string (got INT:1)");
    });

    it("throws when the closing ')' is missing", () => {
      expect(() => parse('get("a"')).toThrow("Expected ')' (got end of input)");
    });
  });
});
