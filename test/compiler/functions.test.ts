import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { Compiler, type MapboxExpression } from "../../src/compiler/compiler";
import { RuntimeError, TypeMismatchError } from "../../src/errors/langError";

function compileSrc(source: string): MapboxExpression {
  const tokens = new Lexer(source).makeToken();
  const ast = new Parser(tokens, source).parse();
  return new Compiler(source).compile(ast);
}

describe("Compiler function calls", () => {
  describe("math", () => {
    it.each([
      ["abs", "abs(-5)", ["abs", ["-", 5]]],
      ["sqrt", "sqrt(9)", ["sqrt", 9]],
      ["ceil", "ceil(1.2)", ["ceil", 1.2]],
      ["floor", "floor(1.8)", ["floor", 1.8]],
      ["round", "round(1.5)", ["round", 1.5]],
      ["sin", "sin(0)", ["sin", 0]],
      ["cos", "cos(0)", ["cos", 0]],
      ["tan", "tan(0)", ["tan", 0]],
      ["asin", "asin(0)", ["asin", 0]],
      ["acos", "acos(1)", ["acos", 1]],
      ["atan", "atan(0)", ["atan", 0]],
      ["ln", "ln(1)", ["ln", 1]],
      ["log2", "log2(8)", ["log2", 8]],
      ["log10", "log10(100)", ["log10", 100]],
    ] as const)(
      "compiles %s(...) to Mapbox's operator of the same name",
      (_fn, source, expected) => {
        expect(compileSrc(source)).toEqual(expected);
      },
    );

    it("compiles variadic min/max with any number of arguments", () => {
      expect(compileSrc("min(1, 2, 3)")).toEqual(["min", 1, 2, 3]);
      expect(compileSrc("max(1, 2)")).toEqual(["max", 1, 2]);
    });

    it("accepts an arbitrary expression as an argument", () => {
      expect(compileSrc('abs(get("x") - 1)')).toEqual(["abs", ["-", ["get", "x"], 1]]);
    });

    it("nests correctly when an argument is itself a function call", () => {
      expect(compileSrc("abs(min(-3, -5))")).toEqual(["abs", ["min", ["-", 3], ["-", 5]]]);
    });
  });

  describe("string", () => {
    it("compiles concat with two or more arguments", () => {
      expect(compileSrc('concat("a", "b", "c")')).toEqual(["concat", "a", "b", "c"]);
    });

    it("compiles upcase/downcase", () => {
      expect(compileSrc('upcase("a")')).toEqual(["upcase", "a"]);
      expect(compileSrc('downcase("A")')).toEqual(["downcase", "A"]);
    });
  });

  describe("color", () => {
    it("compiles rgb with exactly 3 arguments", () => {
      expect(compileSrc("rgb(255, 0, 0)")).toEqual(["rgb", 255, 0, 0]);
    });

    it("compiles rgba with exactly 4 arguments", () => {
      expect(compileSrc("rgba(255, 0, 0, 0.5)")).toEqual(["rgba", 255, 0, 0, 0.5]);
    });
  });

  describe("type conversion", () => {
    it("compiles toNumber/toColor to Mapbox's hyphenated names, with fallback arguments allowed", () => {
      expect(compileSrc('toNumber("5")')).toEqual(["to-number", "5"]);
      expect(compileSrc('toNumber("bad", 5)')).toEqual(["to-number", "bad", 5]);
      expect(compileSrc('toColor("red")')).toEqual(["to-color", "red"]);
      expect(compileSrc('toColor("bad", "red")')).toEqual(["to-color", "bad", "red"]);
    });

    it("compiles toBoolean/toString to Mapbox's hyphenated names, exactly one argument", () => {
      expect(compileSrc("toBoolean(1)")).toEqual(["to-boolean", 1]);
      expect(compileSrc("toString(5)")).toEqual(["to-string", 5]);
    });

    it("compiles typeof unchanged", () => {
      expect(compileSrc("typeof(5)")).toEqual(["typeof", 5]);
    });
  });

  it("compiles coalesce with two or more arguments", () => {
    expect(compileSrc("coalesce(1, 2, 3)")).toEqual(["coalesce", 1, 2, 3]);
  });

  it("is usable as the value of a variable assignment", () => {
    expect(compileSrc("var x = abs(-5)\nx + 1")).toEqual([
      "let",
      "x",
      ["abs", ["-", 5]],
      ["+", ["var", "x"], 1],
    ]);
  });

  it("does not treat a bare identifier without parentheses as a call, even if it shares a function's name", () => {
    expect(compileSrc("var abs = 5\nabs")).toEqual(["let", "abs", 5, ["var", "abs"]]);
  });

  describe("errors", () => {
    it("rejects an unknown function name", () => {
      expect(() => compileSrc("banana(1, 2)")).toThrow(RuntimeError);
      expect(() => compileSrc("banana(1, 2)")).toThrow('Unknown function "banana"');
    });

    it("rejects too few arguments", () => {
      expect(() => compileSrc("abs()")).toThrow('"abs" expects exactly 1 argument, but got 0');
      expect(() => compileSrc("coalesce()")).toThrow(
        '"coalesce" expects at least 1 argument, but got 0',
      );
    });

    it("rejects too many arguments", () => {
      expect(() => compileSrc("abs(1, 2)")).toThrow('"abs" expects exactly 1 argument, but got 2');
      expect(() => compileSrc("rgb(1, 2)")).toThrow('"rgb" expects exactly 3 arguments, but got 2');
    });

    it("rejects functions Mapbox itself documents but MapLibre doesn't implement", () => {
      // Verified against the real evaluator (@maplibre/maplibre-gl-style-spec):
      // "random", "hsl", and "hsla" are all "Unknown expression" there, even
      // though they're real, documented Mapbox operators -- a genuine
      // Mapbox/MapLibre divergence, deliberately left out of FUNCTIONS.
      expect(() => compileSrc("random(1, 10, 42)")).toThrow('Unknown function "random"');
      expect(() => compileSrc("hsl(1, 2, 3)")).toThrow('Unknown function "hsl"');
      expect(() => compileSrc("hsla(1, 2, 3, 0.5)")).toThrow('Unknown function "hsla"');
    });
  });

  describe("interaction with boolean type checking", () => {
    it("rejects a number-returning call as an and/or/not operand", () => {
      expect(() => compileSrc("abs(-5) and true")).toThrow(TypeMismatchError);
      expect(() => compileSrc("abs(-5) and true")).toThrow(
        "'and' requires a boolean operand, but this is a number",
      );
    });

    it("rejects a color-returning call as an if condition", () => {
      expect(() => compileSrc("if rgb(1, 2, 3) then 1 else 2")).toThrow(
        "'if'/'elif' condition must be a boolean, but this is a color",
      );
    });

    it("allows toBoolean(...), since it genuinely returns a boolean", () => {
      expect(() => compileSrc("toBoolean(1) and true")).not.toThrow();
    });

    it("allows coalesce(...), since its return type can't be known statically", () => {
      expect(() => compileSrc("coalesce(true, false) and true")).not.toThrow();
    });
  });

  describe("interaction with 'let' flattening", () => {
    it("does not flatten a variable whose call argument depends on an earlier variable", () => {
      expect(compileSrc("var a = 5\nvar b = abs(a)\na + b")).toEqual([
        "let",
        "a",
        5,
        ["let", "b", ["abs", ["var", "a"]], ["+", ["var", "a"], ["var", "b"]]],
      ]);
    });

    it("flattens a variable whose call doesn't reference any earlier one", () => {
      expect(compileSrc("var a = 5\nvar b = abs(-3)\na + b")).toEqual([
        "let",
        "a",
        5,
        "b",
        ["abs", ["-", 3]],
        ["+", ["var", "a"], ["var", "b"]],
      ]);
    });
  });
});
