import { describe, expect, it } from "vitest";
import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { BinOpNode, BooleanNode, NumberNode, UnaryOpNode, type Node } from "../src/parser/nodes";
import { TokenType } from "../src/lexer/token";
import { IllegalCharError, InvalidSyntaxError } from "../src/errors/langError";

function parse(source: string): Node {
  const tokens = new Lexer(source).makeToken();
  return new Parser(tokens, source).parse();
}

function ast(source: string): string {
  return `${parse(source)}`;
}

describe("Parser", () => {
  describe("literals", () => {
    it("parses a single integer", () => {
      expect(ast("42")).toBe("INT:42");
    });

    it("parses a single float", () => {
      expect(ast("3.14")).toBe("FLOAT:3.14");
    });

    it("parses 'true' and 'false' as boolean literals, not numbers", () => {
      expect(ast("true")).toBe("KEYWORD:true");
      expect(ast("false")).toBe("KEYWORD:false");
    });
  });

  describe("arithmetic precedence and associativity", () => {
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

  describe("boolean literals", () => {
    it("combines with arithmetic, comparisons, and boolean operators like any other atom", () => {
      expect(ast("true + 2")).toBe("(KEYWORD:true, PLUS, INT:2)");
      expect(ast("true == false")).toBe("(KEYWORD:true, EE, KEYWORD:false)");
      expect(ast("true and false")).toBe("(KEYWORD:true, KEYWORD:and, KEYWORD:false)");
      expect(ast("not true")).toBe("(KEYWORD:not, KEYWORD:true)");
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

  describe("node structure", () => {
    // Same behavior as the "arithmetic precedence" tests above, but
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

    it("builds a BooleanNode for 'true'/'false', not a NumberNode", () => {
      const node = parse("true");
      expect(node).toBeInstanceOf(BooleanNode);
      if (node instanceof BooleanNode) {
        expect(node.tok.value).toBe("true");
      }
    });
  });

  describe("errors", () => {
    it("throws on empty input", () => {
      expect(() => parse("")).toThrow(InvalidSyntaxError);
      expect(() => parse("")).toThrow("Unexpected end of input");
    });

    it("throws on a dangling binary operator", () => {
      expect(() => parse("1 +")).toThrow("Unexpected end of input");
    });

    it("throws when a factor can't start with the current token", () => {
      expect(() => parse("*3")).toThrow("Unexpected token: MUL");
    });

    it("mentions get(...) as a valid way to start an atom", () => {
      // Regression: this list went stale once already when get() was
      // added but this message wasn't updated to mention it.
      expect(() => parse("*3")).toThrow("'get(...)'");
    });

    it("throws on a dangling power operator", () => {
      expect(() => parse("2 ^")).toThrow("Unexpected end of input");
    });

    it("throws when the exponent can't start with the current token", () => {
      expect(() => parse("2 ^ * 3")).toThrow("Unexpected token: MUL");
    });

    it("throws on an unmatched closing paren", () => {
      expect(() => parse(")")).toThrow("Unexpected token: RPAREN");
    });

    it("throws on empty parentheses", () => {
      expect(() => parse("()")).toThrow("Unexpected token: RPAREN");
    });

    it("throws when a closing paren is missing, and says what was found instead", () => {
      expect(() => parse("(1 + 2")).toThrow("Expected ')' (got end of input)");
    });

    describe("get() errors", () => {
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

    describe("comparison and logical operator errors", () => {
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

    it("throws on leftover input after an otherwise-complete expression", () => {
      expect(() => parse("1 + 2 3")).toThrow(InvalidSyntaxError);
      expect(() => parse("1 + 2 3")).toThrow("Unexpected token: INT:3");
    });

    it("propagates a lexer error without ever reaching the parser", () => {
      expect(() => parse("1 + @")).toThrow(IllegalCharError);
      expect(() => parse("1 + @")).toThrow("'@'");
    });

    it("points the error at the actual offending token", () => {
      try {
        parse("1 + 2 3");
        throw new Error("expected parse() to throw, but it didn't");
      } catch (error) {
        if (!(error instanceof InvalidSyntaxError)) throw error;
        expect(error.posStart).toMatchObject({ idx: 6, ln: 0, col: 6 });
      }
    });
  });
});
