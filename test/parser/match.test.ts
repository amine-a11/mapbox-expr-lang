import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { MatchNode, StringNode, type Node } from "../../src/parser/nodes";

function parse(source: string): Node {
  const tokens = new Lexer(source).makeToken();
  return new Parser(tokens, source).parse();
}

function ast(source: string): string {
  return `${parse(source)}`;
}

describe("Parser match expressions", () => {
  it("parses a single label with then/else", () => {
    expect(ast('match get("type") "road" then "red" else "blue"')).toBe(
      "(MATCH GET:type STRING:road -> STRING:red ELSE STRING:blue)",
    );
  });

  it("parses multiple arms, including a comma-separated label list sharing one output", () => {
    const source = `match get("type")
      "road" then "red"
      "water", "lake" then "blue"
      else "green"`;
    expect(ast(source)).toBe(
      "(MATCH GET:type STRING:road -> STRING:red, STRING:water, STRING:lake -> STRING:blue ELSE STRING:green)",
    );
  });

  it("accepts number labels", () => {
    expect(ast('match get("n") 1 then "one" else "other"')).toBe(
      "(MATCH GET:n INT:1 -> STRING:one ELSE STRING:other)",
    );
  });

  it("is usable as the value of a variable assignment", () => {
    const source = 'var color = match get("type")\n  "road" then "red"\n  else "blue"';
    expect(ast(source)).toBe(
      "(VAR:color, (MATCH GET:type STRING:road -> STRING:red ELSE STRING:blue), IDENTIFIER:color)",
    );
  });

  it("combines with arithmetic and comparisons like any other atom", () => {
    expect(ast('1 + match get("n") 1 then 10 else 20')).toBe(
      "(INT:1, PLUS, (MATCH GET:n INT:1 -> INT:10 ELSE INT:20))",
    );
  });

  describe("node structure", () => {
    it("builds a MatchNode with input, cases, and elseCase in the right place", () => {
      const node = parse('match get("type") "road", "highway" then "red" else "blue"');
      expect(node).toBeInstanceOf(MatchNode);
      if (node instanceof MatchNode) {
        expect(node.cases).toHaveLength(1);
        expect(node.cases[0]?.labels).toHaveLength(2);
        expect(node.cases[0]?.labels[0]).toBeInstanceOf(StringNode);
        expect(node.cases[0]?.labels[1]).toBeInstanceOf(StringNode);
        expect(node.cases[0]?.value).toBeInstanceOf(StringNode);
        expect(node.elseCase).toBeInstanceOf(StringNode);
      }
    });
  });

  describe("errors", () => {
    it("throws when 'then' is missing", () => {
      expect(() => parse('match get("type") "road" "red" else "blue"')).toThrow(
        "Expected 'then' (got STRING:red)",
      );
    });

    it("throws when 'else' is missing", () => {
      expect(() => parse('match get("type") "road" then "red"')).toThrow(
        "Unexpected end of input, expected a number, a string, or 'else'",
      );
    });

    it("throws when there are no arms at all", () => {
      expect(() => parse('match get("type") else "blue"')).toThrow(
        "Unexpected token: KEYWORD:else, expected a number or a string",
      );
    });

    it("throws when a label is missing after a comma", () => {
      expect(() => parse('match get("type") "road", then "red" else "blue"')).toThrow(
        "Unexpected token: KEYWORD:then, expected a number or a string",
      );
    });

    it("mentions 'match' as a valid way to start an atom", () => {
      expect(() => parse("*3")).toThrow("'match'");
    });
  });
});
