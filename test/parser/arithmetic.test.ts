import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { BinOpNode, NumberNode, UnaryOpNode, type Node } from "../../src/parser/nodes";
import { TokenType } from "../../src/lexer/token";

function parse(source: string): Node {
  const tokens = new Lexer(source).makeToken();
  return new Parser(tokens, source).parse();
}

function ast(source: string): string {
  return `${parse(source)}`;
}

describe("Parser arithmetic", () => {
  describe("precedence and associativity", () => {
    it("binds * and / tighter than + and -, regardless of order", () => {
      expect(ast("1 + 2 * 3")).toBe("(INT:1, PLUS, (INT:2, MUL, INT:3))");
      expect(ast("1 * 2 + 3")).toBe("((INT:1, MUL, INT:2), PLUS, INT:3)");
    });

    it("binds % at the same precedence as * and /", () => {
      expect(ast("1 + 2 % 3")).toBe("(INT:1, PLUS, (INT:2, MOD, INT:3))");
    });

    it("is left-associative for same-precedence operators", () => {
      // "1 - 2 - 3" must parse as (1 - 2) - 3, not 1 - (2 - 3) -- these
      // are both plausible-looking groupings but give different results.
      expect(ast("1 - 2 - 3")).toBe("((INT:1, MINUS, INT:2), MINUS, INT:3)");
      // Confirm the two groupings really are different, via explicit parens.
      expect(ast("1 - (2 - 3)")).toBe("(INT:1, MINUS, (INT:2, MINUS, INT:3))");
    });
  });

  describe("power operator", () => {
    it("binds tighter than * and /", () => {
      expect(ast("2 * 3 ^ 2")).toBe("(INT:2, MUL, (INT:3, POW, INT:2))");
    });

    it("is right-associative", () => {
      // "2 ^ 3 ^ 2" must parse as 2 ^ (3 ^ 2), not (2 ^ 3) ^ 2 -- these
      // give different results (512 vs 64), unlike + or * where grouping
      // direction wouldn't matter.
      expect(ast("2 ^ 3 ^ 2")).toBe("(INT:2, POW, (INT:3, POW, INT:2))");
      // Confirm the two groupings really are different, via explicit parens.
      expect(ast("(2 ^ 3) ^ 2")).toBe("((INT:2, POW, INT:3), POW, INT:2)");
    });

    it("gives unary minus lower precedence, matching standard math convention", () => {
      // -2 ^ 2 means -(2 ^ 2) = -4, not (-2) ^ 2 = 4.
      expect(ast("-2 ^ 2")).toBe("(MINUS, (INT:2, POW, INT:2))");
    });

    it("accepts a unary-signed exponent", () => {
      expect(ast("2 ^ -2")).toBe("(INT:2, POW, (MINUS, INT:2))");
    });
  });

  describe("unary operators", () => {
    it("parses unary minus and plus", () => {
      expect(ast("-5")).toBe("(MINUS, INT:5)");
      expect(ast("+5")).toBe("(PLUS, INT:5)");
    });

    it("chains multiple unary operators", () => {
      expect(ast("--5")).toBe("(MINUS, (MINUS, INT:5))");
    });

    it("distinguishes unary from binary +/-", () => {
      expect(ast("5 + -3")).toBe("(INT:5, PLUS, (MINUS, INT:3))");
      expect(ast("-5 + 3")).toBe("((MINUS, INT:5), PLUS, INT:3)");
    });

    it("applies to a parenthesized expression", () => {
      expect(ast("-(1 + 2)")).toBe("(MINUS, (INT:1, PLUS, INT:2))");
    });
  });

  describe("parentheses", () => {
    it("overrides default precedence", () => {
      expect(ast("(1 + 2) * 3")).toBe("((INT:1, PLUS, INT:2), MUL, INT:3)");
    });

    it("unwraps without adding an extra node", () => {
      const node = parse("((1))");
      expect(node).toBeInstanceOf(NumberNode);
      expect(`${node}`).toBe("INT:1");
    });
  });

  describe("node structure", () => {
    // Same behavior as the "precedence and associativity" tests above, but
    // asserted by walking the actual object graph instead of comparing
    // strings -- catches bugs a toString() typo could otherwise hide.
    it("builds a BinOpNode with the operands and operator in the right place", () => {
      const node = parse("1 + 2");
      expect(node).toBeInstanceOf(BinOpNode);
      if (node instanceof BinOpNode) {
        expect(node.leftNode).toBeInstanceOf(NumberNode);
        expect(node.rightNode).toBeInstanceOf(NumberNode);
        expect(node.opToken.type).toBe(TokenType.PLUS);
      }
    });

    it("builds a UnaryOpNode wrapping its operand", () => {
      const node = parse("-5");
      expect(node).toBeInstanceOf(UnaryOpNode);
      if (node instanceof UnaryOpNode) {
        expect(node.opTok.type).toBe(TokenType.MINUS);
        expect(node.node).toBeInstanceOf(NumberNode);
      }
    });
  });

  describe("errors", () => {
    it("throws on a dangling binary operator", () => {
      expect(() => parse("1 +")).toThrow("Unexpected end of input");
    });

    it("throws when a factor can't start with the current token", () => {
      expect(() => parse("*3")).toThrow("Unexpected token: MUL");
    });

    it("throws on a dangling power operator", () => {
      expect(() => parse("2 ^")).toThrow("Unexpected end of input");
    });

    it("throws when the exponent can't start with the current token", () => {
      expect(() => parse("2 ^ * 3")).toThrow("Unexpected token: MUL");
    });
  });
});
