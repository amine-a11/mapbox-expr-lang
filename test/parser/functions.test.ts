import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { CallNode, NumberNode, VarAccessNode, type Node } from "../../src/parser/nodes";

function parse(source: string): Node {
  const tokens = new Lexer(source).makeToken();
  return new Parser(tokens, source).parse();
}

function ast(source: string): string {
  return `${parse(source)}`;
}

describe("Parser function calls", () => {
  it("parses a single-argument call", () => {
    expect(ast("abs(-5)")).toBe("CALL:abs((MINUS, INT:5))");
  });

  it("parses a multi-argument call", () => {
    expect(ast("min(1, 2, 3)")).toBe("CALL:min(INT:1, INT:2, INT:3)");
  });

  it("parses a zero-argument call", () => {
    // The parser doesn't know which names are real functions -- that's a
    // compiler-level concern -- so any identifier works here.
    expect(ast("foo()")).toBe("CALL:foo()");
  });

  it("combines with arithmetic like any other atom", () => {
    expect(ast("1 + sqrt(4)")).toBe("(INT:1, PLUS, CALL:sqrt(INT:4))");
  });

  it("is usable as the value of a variable assignment", () => {
    expect(ast("var x = abs(-5)")).toBe("(VAR:x, CALL:abs((MINUS, INT:5)), IDENTIFIER:x)");
  });

  it("does not treat a bare identifier without parentheses as a call", () => {
    const node = parse("a");
    expect(node).toBeInstanceOf(VarAccessNode);
    expect(node).not.toBeInstanceOf(CallNode);
  });

  it("accepts an arbitrary expression as an argument, not just a literal", () => {
    expect(ast('abs(get("x") - 1)')).toBe("CALL:abs((GET:x, MINUS, INT:1))");
  });

  it("allows a function call as an argument to another call", () => {
    expect(ast("abs(min(-3, -5))")).toBe("CALL:abs(CALL:min((MINUS, INT:3), (MINUS, INT:5)))");
  });

  describe("node structure", () => {
    it("builds a CallNode with the name token and args in the right place", () => {
      const node = parse("min(1, 2, 3)");
      expect(node).toBeInstanceOf(CallNode);
      if (node instanceof CallNode) {
        expect(node.nameTok.value).toBe("min");
        expect(node.args).toHaveLength(3);
        expect(node.args[0]).toBeInstanceOf(NumberNode);
      }
    });

    it("builds a CallNode with an empty args array for a zero-argument call", () => {
      const node = parse("foo()");
      expect(node).toBeInstanceOf(CallNode);
      if (node instanceof CallNode) {
        expect(node.args).toHaveLength(0);
      }
    });
  });

  describe("errors", () => {
    it("throws when the closing ')' is missing", () => {
      expect(() => parse("abs(1")).toThrow("Expected ')' (got end of input)");
    });

    it("throws when an argument is missing after a comma", () => {
      expect(() => parse("min(1, )")).toThrow("Unexpected token: RPAREN");
    });

    it("throws when a comma is missing between arguments", () => {
      expect(() => parse("min(1 2)")).toThrow("Expected ')' (got INT:2)");
    });
  });
});
