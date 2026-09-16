import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import {
  BinOpNode,
  NumberNode,
  VarAccessNode,
  VarAssignNode,
  type Node,
} from "../../src/parser/nodes";

function parse(source: string): Node {
  const tokens = new Lexer(source).makeToken();
  return new Parser(tokens, source).parse();
}

function ast(source: string): string {
  return `${parse(source)}`;
}

describe("Parser variables", () => {
  it("parses a variable assignment, defaulting its body to reading itself back", () => {
    expect(ast("var a = 5")).toBe("(VAR:a, INT:5, IDENTIFIER:a)");
  });

  it("parses a variable access as a plain atom", () => {
    expect(ast("a")).toBe("IDENTIFIER:a");
  });

  it("allows an arbitrary expression as the assigned value", () => {
    expect(ast("var a = 1 + 2")).toBe("(VAR:a, (INT:1, PLUS, INT:2), IDENTIFIER:a)");
  });

  it("combines a variable access with arithmetic like any other atom", () => {
    expect(ast("a + 1")).toBe("(IDENTIFIER:a, PLUS, INT:1)");
  });

  it("is only recognized as a variable assignment at the start of a statement", () => {
    expect(() => parse("1 + var a = 5")).toThrow("Unexpected token: KEYWORD:var");
  });

  it("is rejected as the value of another variable assignment", () => {
    expect(() => parse("var a = var b = 5")).toThrow("Unexpected token: KEYWORD:var");
  });

  it("is rejected inside parentheses", () => {
    expect(() => parse("1 + (var a = 5)")).toThrow("Unexpected token: KEYWORD:var");
  });

  describe("statement sequences (multiple lines)", () => {
    it("threads a variable's body into everything that follows it on later lines", () => {
      expect(ast("var a = 5\na + 1")).toBe("(VAR:a, INT:5, (IDENTIFIER:a, PLUS, INT:1))");
    });

    it("chains three variables, each seeing the ones declared before it", () => {
      expect(ast("var a = 1\nvar b = a + 1\nb")).toBe(
        "(VAR:a, INT:1, (VAR:b, (IDENTIFIER:a, PLUS, INT:1), IDENTIFIER:b))",
      );
    });

    it("tolerates leading, trailing, and repeated blank lines", () => {
      expect(ast("\n\nvar a = 5\n\n\na\n\n")).toBe("(VAR:a, INT:5, IDENTIFIER:a)");
    });

    it("treats a lone CRLF the same as a lone LF", () => {
      expect(ast("var a = 5\r\na")).toBe("(VAR:a, INT:5, IDENTIFIER:a)");
    });

    it("rejects a non-'var' statement that isn't the last one", () => {
      expect(() => parse("5 + 3\nvar a = 1")).toThrow("This expression's value is unused");
      expect(() => parse("var a = 1\n2 + 2\na")).toThrow("This expression's value is unused");
    });

    it("still allows a lone non-'var' expression when it's the only (last) statement", () => {
      expect(ast("1 + 2")).toBe("(INT:1, PLUS, INT:2)");
    });

    it("allows shadowing the same name across statements, not just mutating it", () => {
      expect(ast("var a = 10\nvar a = a + 5\na")).toBe(
        "(VAR:a, INT:10, (VAR:a, (IDENTIFIER:a, PLUS, INT:5), IDENTIFIER:a))",
      );
    });
  });

  describe("node structure", () => {
    it("builds a VarAssignNode with the name token, value, and body in the right place", () => {
      const node = parse("var a = 5");
      expect(node).toBeInstanceOf(VarAssignNode);
      if (node instanceof VarAssignNode) {
        expect(node.varNameTok.value).toBe("a");
        expect(node.valueNode).toBeInstanceOf(NumberNode);
        expect(node.bodyNode).toBeInstanceOf(VarAccessNode);
      }
    });

    it("threads a real body into bodyNode when a statement follows", () => {
      const node = parse("var a = 5\na + 1");
      expect(node).toBeInstanceOf(VarAssignNode);
      if (node instanceof VarAssignNode) {
        expect(node.bodyNode).toBeInstanceOf(BinOpNode);
      }
    });

    it("derives posEnd from the body, not the value, once a real body is threaded in", () => {
      // "var a = 5\na + 1": the body ("a + 1") ends at index 11, well past
      // where the value ("5") alone would end (index 9) -- this is the
      // getter in VarAssignNode.posEnd staying correct after Parser
      // mutates bodyNode.
      const node = parse("var a = 5\na + 1");
      expect(node.posEnd).toMatchObject({ idx: 15 });
    });

    it("builds a VarAccessNode wrapping the identifier token", () => {
      const node = parse("a");
      expect(node).toBeInstanceOf(VarAccessNode);
      if (node instanceof VarAccessNode) {
        expect(node.tok.value).toBe("a");
      }
    });
  });

  describe("errors", () => {
    it("throws when the variable name is missing", () => {
      expect(() => parse("var")).toThrow("Expected an identifier (got end of input)");
    });

    it("throws when a non-identifier follows 'var'", () => {
      expect(() => parse("var 5 = 1")).toThrow("Expected an identifier (got INT:5)");
    });

    it("throws when '=' is missing", () => {
      expect(() => parse("var a")).toThrow("Expected '=' (got end of input)");
    });

    it("throws when the assigned value is missing", () => {
      expect(() => parse("var a =")).toThrow("Unexpected end of input");
    });

    it("mentions 'an identifier' as a valid way to start an atom", () => {
      expect(() => parse("*3")).toThrow("an identifier");
    });
  });
});
