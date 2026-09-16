import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { Compiler, type MapboxExpression } from "../../src/compiler/compiler";
import { TypeMismatchError } from "../../src/errors/langError";

function compileSrc(source: string): MapboxExpression {
  const tokens = new Lexer(source).makeToken();
  const ast = new Parser(tokens, source).parse();
  return new Compiler(source).compile(ast);
}

// This is one file rather than split per-feature because all of these
// checks share the same underlying mechanism (inferType() in the
// compiler, with nonBooleanType()/nonNumericType() as thin wrappers around
// it): prove what's cheap to prove (a literal, an arithmetic/comparison
// result, or a function/constant with a fixed return type), defer
// everything else (get(), variables, if/match/interpolate/step results) to
// Mapbox's own error.
describe("Compiler type checking", () => {
  describe("and/or/not require a boolean operand", () => {
    it("rejects a number operand to 'and'", () => {
      expect(() => compileSrc("1 and 2")).toThrow(TypeMismatchError);
      expect(() => compileSrc("1 and 2")).toThrow(
        "'and' requires a boolean operand, but this is a number",
      );
    });

    it("rejects a number operand to 'or'", () => {
      expect(() => compileSrc("1 or true")).toThrow(
        "'or' requires a boolean operand, but this is a number",
      );
    });

    it("rejects a number operand to 'not'", () => {
      expect(() => compileSrc("not 1")).toThrow(
        "'not' requires a boolean operand, but this is a number",
      );
    });

    it("rejects a string operand to 'and'/'or'/'not'", () => {
      expect(() => compileSrc('"hello" and true')).toThrow(TypeMismatchError);
      expect(() => compileSrc('"hello" and true')).toThrow(
        "'and' requires a boolean operand, but this is a string",
      );
      expect(() => compileSrc('true or "hello"')).toThrow(
        "'or' requires a boolean operand, but this is a string",
      );
      expect(() => compileSrc('not "hello"')).toThrow(
        "'not' requires a boolean operand, but this is a string",
      );
    });

    it("rejects an arithmetic expression, not just a literal number", () => {
      expect(() => compileSrc("(1 + 2) and true")).toThrow(
        "'and' requires a boolean operand, but this is a number",
      );
      expect(() => compileSrc("not (3 * 4)")).toThrow(
        "'not' requires a boolean operand, but this is a number",
      );
    });

    it("allows comparisons, booleans, and nested and/or/not as operands", () => {
      expect(() => compileSrc("(1 > 2) and (3 < 4)")).not.toThrow();
      expect(() => compileSrc("true and false")).not.toThrow();
      expect(() => compileSrc("not (1 > 2)")).not.toThrow();
    });

    it("allows get(), variables, and if-results, since their type can't be known statically", () => {
      expect(() => compileSrc('get("active") and true')).not.toThrow();
      expect(() => compileSrc("var isFast = 1 > 0\nisFast and true")).not.toThrow();
      expect(() => compileSrc("(if 1 > 0 then true else false) and true")).not.toThrow();
    });

    it("points the error at the offending operand, not the whole expression", () => {
      try {
        compileSrc("true and 5");
        throw new Error("expected compileSrc() to throw, but it didn't");
      } catch (error) {
        if (!(error instanceof TypeMismatchError)) throw error;
        expect(error.posStart).toMatchObject({ idx: 9, ln: 0, col: 9 });
        expect(error.posEnd).toMatchObject({ idx: 10, ln: 0, col: 10 });
      }
    });
  });

  describe("if/elif conditions must be boolean", () => {
    it("rejects a number condition", () => {
      expect(() => compileSrc("if 1 then 1 else 2")).toThrow(
        "'if'/'elif' condition must be a boolean, but this is a number",
      );
      expect(() => compileSrc("if 1 > 0 then 1 elif 5 then 2 else 3")).toThrow(
        "'if'/'elif' condition must be a boolean, but this is a number",
      );
    });

    it("rejects a string condition", () => {
      expect(() => compileSrc('if "hello" then 1 else 2')).toThrow(
        "'if'/'elif' condition must be a boolean, but this is a string",
      );
    });

    it("allows a comparison, a boolean literal, get(), or a variable as the condition", () => {
      expect(() => compileSrc("if 1 > 0 then 1 else 2")).not.toThrow();
      expect(() => compileSrc("if true then 1 else 2")).not.toThrow();
      expect(() => compileSrc('if get("active") then 1 else 2')).not.toThrow();
    });
  });

  describe("match input must be number or string", () => {
    it("rejects a boolean input", () => {
      expect(() => compileSrc('match true "x" then 1 else 2')).toThrow(TypeMismatchError);
      expect(() => compileSrc('match true "x" then 1 else 2')).toThrow(
        "'match' input must be a number or a string, but this is a boolean",
      );
      expect(() => compileSrc('match (1 > 0) "x" then 1 else 2')).toThrow(
        "'match' input must be a number or a string, but this is a boolean",
      );
    });

    it("rejects a color input", () => {
      expect(() => compileSrc('match rgb(1, 2, 3) "x" then 1 else 2')).toThrow(
        "'match' input must be a number or a string, but this is a color",
      );
    });

    it("rejects an object input", () => {
      expect(() => compileSrc('match feature.properties "x" then 1 else 2')).toThrow(
        "'match' input must be a number or a string, but this is an object",
      );
    });

    it("allows get(), variables, and comparisons resolving through them as input, since their type can't be known statically", () => {
      expect(() => compileSrc('match get("type") "road" then 1 else 2')).not.toThrow();
      expect(() => compileSrc('var t = get("type")\nmatch t "road" then 1 else 2')).not.toThrow();
    });
  });

  it("allows a string as a comparison operand -- only and/or/not/if/match reject strings", () => {
    expect(() => compileSrc('("road" == "water") and true')).not.toThrow();
  });

  describe("arithmetic operands must be numeric", () => {
    it.each(["+", "-", "*", "/", "%", "^"] as const)("rejects a boolean operand to '%s'", (op) => {
      expect(() => compileSrc(`true ${op} 1`)).toThrow(TypeMismatchError);
      expect(() => compileSrc(`true ${op} 1`)).toThrow(
        `'${op}' requires a numeric operand, but this is a boolean`,
      );
      expect(() => compileSrc(`1 ${op} true`)).toThrow(
        `'${op}' requires a numeric operand, but this is a boolean`,
      );
    });

    it("rejects a string operand", () => {
      expect(() => compileSrc('"5" + 1')).toThrow(
        "'+' requires a numeric operand, but this is a string",
      );
    });

    it("rejects a color-returning call as an operand", () => {
      expect(() => compileSrc("rgb(1, 2, 3) + 1")).toThrow(
        "'+' requires a numeric operand, but this is a color",
      );
    });

    it("rejects a boolean-returning call as an operand", () => {
      expect(() => compileSrc("toBoolean(1) + 1")).toThrow(
        "'+' requires a numeric operand, but this is a boolean",
      );
    });

    it("rejects unary minus on a non-numeric operand", () => {
      expect(() => compileSrc("-true")).toThrow(
        "'-' requires a numeric operand, but this is a boolean",
      );
      expect(() => compileSrc('-"5"')).toThrow(
        "'-' requires a numeric operand, but this is a string",
      );
    });

    it("allows nested arithmetic, since the result of + - * / % ^ is always a number", () => {
      expect(() => compileSrc("(1 + 2) * 3")).not.toThrow();
    });

    it("allows get(), variables, and if-results, since their type can't be known statically", () => {
      expect(() => compileSrc('get("speed") + 1')).not.toThrow();
      expect(() => compileSrc("var x = 1\nx + 1")).not.toThrow();
      expect(() => compileSrc("(if true then 1 else 2) + 1")).not.toThrow();
    });

    it("points the error at the offending operand, not the whole expression", () => {
      try {
        compileSrc("1 + true");
        throw new Error("expected compileSrc() to throw, but it didn't");
      } catch (error) {
        if (!(error instanceof TypeMismatchError)) throw error;
        expect(error.posStart).toMatchObject({ idx: 4, ln: 0, col: 4 });
        expect(error.posEnd).toMatchObject({ idx: 8, ln: 0, col: 8 });
      }
    });
  });
});
