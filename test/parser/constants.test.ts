import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { ConstantNode, VarAccessNode, type Node } from "../../src/parser/nodes";

function parse(source: string): Node {
  const tokens = new Lexer(source).makeToken();
  return new Parser(tokens, source).parse();
}

function ast(source: string): string {
  return `${parse(source)}`;
}

describe("Parser namespaced constants", () => {
  it("parses a namespace.member access", () => {
    expect(ast("math.e")).toBe("CONST:math.e");
  });

  it("combines with arithmetic like any other atom", () => {
    expect(ast("1 + math.pi")).toBe("(INT:1, PLUS, CONST:math.pi)");
  });

  it("is usable as the value of a variable assignment", () => {
    expect(ast("var x = math.e")).toBe("(VAR:x, CONST:math.e, IDENTIFIER:x)");
  });

  it("does not treat a bare identifier without a dot as a constant access", () => {
    const node = parse("a");
    expect(node).toBeInstanceOf(VarAccessNode);
    expect(node).not.toBeInstanceOf(ConstantNode);
  });

  describe("node structure", () => {
    it("builds a ConstantNode with the namespace and member tokens in the right place", () => {
      const node = parse("camera.zoom");
      expect(node).toBeInstanceOf(ConstantNode);
      if (node instanceof ConstantNode) {
        expect(node.namespaceTok.value).toBe("camera");
        expect(node.memberTok.value).toBe("zoom");
      }
    });
  });

  describe("errors", () => {
    it("throws when the member name is missing after the dot", () => {
      expect(() => parse("math.")).toThrow("Expected a constant name (got end of input)");
    });

    it("throws when the member name isn't an identifier", () => {
      expect(() => parse("math.5")).toThrow("Expected a constant name");
    });
  });
});
