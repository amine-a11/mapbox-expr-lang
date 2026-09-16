import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { BooleanNode, StringNode, type Node } from "../../src/parser/nodes";

function parse(source: string): Node {
  const tokens = new Lexer(source).makeToken();
  return new Parser(tokens, source).parse();
}

function ast(source: string): string {
  return `${parse(source)}`;
}

describe("Parser literals", () => {
  describe("numbers", () => {
    it("parses a single integer", () => {
      expect(ast("42")).toBe("INT:42");
    });

    it("parses a single float", () => {
      expect(ast("3.14")).toBe("FLOAT:3.14");
    });
  });

  describe("strings", () => {
    it("parses a double-quoted or single-quoted string as a bare atom", () => {
      expect(ast('"red"')).toBe("STRING:red");
      expect(ast("'red'")).toBe("STRING:red");
    });

    it("parses an empty string", () => {
      expect(ast('""')).toBe("STRING:");
    });

    it("combines with comparisons, get(), and if expressions like any other atom", () => {
      expect(ast('"road" == "water"')).toBe("(STRING:road, EE, STRING:water)");
      expect(ast('get("type") == "road"')).toBe("(GET:type, EE, STRING:road)");
      expect(ast('if get("type") == "road" then "red" else "blue"')).toBe(
        "(IF (GET:type, EE, STRING:road) -> STRING:red ELSE STRING:blue)",
      );
    });

    it("is usable as the value of a variable assignment", () => {
      expect(ast('var color = "red"')).toBe("(VAR:color, STRING:red, IDENTIFIER:color)");
    });

    it("builds a StringNode wrapping the string token", () => {
      const node = parse('"red"');
      expect(node).toBeInstanceOf(StringNode);
      if (node instanceof StringNode) {
        expect(node.tok.value).toBe("red");
      }
    });

    it("mentions 'string' as a valid way to start an atom", () => {
      expect(() => parse("*3")).toThrow("string");
    });
  });

  describe("booleans", () => {
    it("parses 'true' and 'false' as boolean literals, not numbers", () => {
      expect(ast("true")).toBe("KEYWORD:true");
      expect(ast("false")).toBe("KEYWORD:false");
    });

    it("combines with arithmetic, comparisons, and boolean operators like any other atom", () => {
      expect(ast("true + 2")).toBe("(KEYWORD:true, PLUS, INT:2)");
      expect(ast("true == false")).toBe("(KEYWORD:true, EE, KEYWORD:false)");
      expect(ast("true and false")).toBe("(KEYWORD:true, KEYWORD:and, KEYWORD:false)");
      expect(ast("not true")).toBe("(KEYWORD:not, KEYWORD:true)");
    });

    it("builds a BooleanNode for 'true'/'false', not a NumberNode", () => {
      const node = parse("true");
      expect(node).toBeInstanceOf(BooleanNode);
      if (node instanceof BooleanNode) {
        expect(node.tok.value).toBe("true");
      }
    });
  });
});
