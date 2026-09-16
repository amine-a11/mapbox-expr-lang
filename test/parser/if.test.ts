import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { BinOpNode, IfNode, NumberNode, type Node } from "../../src/parser/nodes";

function parse(source: string): Node {
  const tokens = new Lexer(source).makeToken();
  return new Parser(tokens, source).parse();
}

function ast(source: string): string {
  return `${parse(source)}`;
}

describe("Parser if expressions", () => {
  it("parses a single if/then/else", () => {
    expect(ast("if 1 > 0 then 1 else 2")).toBe("(IF (INT:1, GT, INT:0) -> INT:1 ELSE INT:2)");
  });

  it("parses if/elif/then/else with multiple cases", () => {
    expect(ast("if 1 > 5 then 1 elif 1 > 0 then 2 else 3")).toBe(
      "(IF (INT:1, GT, INT:5) -> INT:1, (INT:1, GT, INT:0) -> INT:2 ELSE INT:3)",
    );
  });

  it("is usable as the value of a variable assignment", () => {
    expect(ast("var x = if 1 > 0 then 1 else 2")).toBe(
      "(VAR:x, (IF (INT:1, GT, INT:0) -> INT:1 ELSE INT:2), IDENTIFIER:x)",
    );
  });

  it("combines with arithmetic and comparisons like any other atom", () => {
    expect(ast("1 + if 1 > 0 then 1 else 2")).toBe(
      "(INT:1, PLUS, (IF (INT:1, GT, INT:0) -> INT:1 ELSE INT:2))",
    );
  });

  it("allows newlines between then/elif/else and their bodies", () => {
    const source = `if 1 > 5 then
      1
    elif 1 > 0 then
      2
    else
      3`;
    expect(ast(source)).toBe(
      "(IF (INT:1, GT, INT:5) -> INT:1, (INT:1, GT, INT:0) -> INT:2 ELSE INT:3)",
    );
  });

  it("does not swallow the newline that separates it from the next statement", () => {
    const source = "var a = if 1 > 0 then 1 else 2\nvar b = 10\na + b";
    expect(ast(source)).toBe(
      "(VAR:a, (IF (INT:1, GT, INT:0) -> INT:1 ELSE INT:2), (VAR:b, INT:10, (IDENTIFIER:a, PLUS, IDENTIFIER:b)))",
    );
  });

  describe("node structure", () => {
    it("builds an IfNode with cases and elseCase in the right place", () => {
      const node = parse("if 1 > 5 then 1 elif 1 > 0 then 2 else 3");
      expect(node).toBeInstanceOf(IfNode);
      if (node instanceof IfNode) {
        expect(node.cases).toHaveLength(2);
        expect(node.cases[0]?.condition).toBeInstanceOf(BinOpNode);
        expect(node.cases[0]?.value).toBeInstanceOf(NumberNode);
        expect(node.cases[1]?.condition).toBeInstanceOf(BinOpNode);
        expect(node.elseCase).toBeInstanceOf(NumberNode);
      }
    });
  });

  describe("errors", () => {
    it("throws when 'then' is missing", () => {
      expect(() => parse("if 1 > 0 1 else 2")).toThrow("Expected 'then' (got INT:1)");
    });

    it("throws when 'else' is missing", () => {
      expect(() => parse("if 1 > 0 then 1")).toThrow("Expected 'else' (got end of input)");
    });

    it("throws when 'else' is missing but an elif was present", () => {
      expect(() => parse("if 1 > 0 then 1 elif 2 > 0 then 2")).toThrow(
        "Expected 'else' (got end of input)",
      );
    });

    it("throws when the condition is missing", () => {
      expect(() => parse("if then 1 else 2")).toThrow("Unexpected token: KEYWORD:then");
    });

    it("throws when a branch's value is missing", () => {
      expect(() => parse("if 1 > 0 then else 2")).toThrow("Unexpected token: KEYWORD:else");
    });

    it("mentions 'if' as a valid way to start an atom", () => {
      expect(() => parse("*3")).toThrow("'if'");
    });
  });
});
