import { describe, expect, it } from "vitest";
import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { Compiler, type MapboxExpression } from "../src/compiler/compiler";
import { RuntimeError } from "../src/errors/langError";

function compileSrc(source: string, optimize = false): MapboxExpression {
  const tokens = new Lexer(source).makeToken();
  const ast = new Parser(tokens, source).parse();
  return new Compiler(source, optimize).compile(ast);
}

describe("Compiler", () => {
  describe("literals", () => {
    it("compiles an integer to a raw number", () => {
      expect(compileSrc("42")).toBe(42);
    });

    it("compiles a float to a raw number", () => {
      expect(compileSrc("3.14")).toBe(3.14);
    });
  });

  describe("binary operators (unoptimized)", () => {
    it.each([
      ["+", "1 + 2", ["+", 1, 2]],
      ["-", "1 - 2", ["-", 1, 2]],
      ["*", "1 * 2", ["*", 1, 2]],
      ["/", "1 / 2", ["/", 1, 2]],
      ["%", "1 % 2", ["%", 1, 2]],
      ["^", "1 ^ 2", ["^", 1, 2]],
    ] as const)("compiles %s to a Mapbox expression array", (_op, source, expected) => {
      expect(compileSrc(source)).toEqual(expected);
    });
  });

  describe("unary operators (unoptimized)", () => {
    it("compiles unary minus to Mapbox's single-argument negation form", () => {
      // Not ["*", -1, 5] -- Mapbox's own "-" operator negates when given
      // exactly one argument, so that's the spec-correct representation.
      expect(compileSrc("-5")).toEqual(["-", 5]);
    });

    it("treats unary plus as a no-op", () => {
      expect(compileSrc("+5")).toBe(5);
    });

    it("chains multiple unary minuses without collapsing them", () => {
      expect(compileSrc("--5")).toEqual(["-", ["-", 5]]);
    });
  });

  describe("precedence and grouping survive into the compiled output", () => {
    it("keeps * nested inside + when + is outermost", () => {
      expect(compileSrc("1 + 2 * 3")).toEqual(["+", 1, ["*", 2, 3]]);
    });

    it("respects explicit parentheses", () => {
      expect(compileSrc("(1 + 2) * 3")).toEqual(["*", ["+", 1, 2], 3]);
    });
  });

  describe("variadic flattening of + and *", () => {
    it("flattens a left-associative chain of + into one array", () => {
      // The parser builds this as (((1 + 2) + 3) + 4); the compiler must
      // still produce a single flat array, not three nested ones.
      expect(compileSrc("1 + 2 + 3 + 4")).toEqual(["+", 1, 2, 3, 4]);
    });

    it("flattens a left-associative chain of * into one array", () => {
      expect(compileSrc("2 * 3 * 4")).toEqual(["*", 2, 3, 4]);
    });

    it("is unconditional -- happens even without optimize", () => {
      expect(compileSrc("1 + 2 + 3", false)).toEqual(["+", 1, 2, 3]);
    });

    it("does not flatten - chains (Mapbox's '-' only takes 1-2 args)", () => {
      expect(compileSrc("10 - 2 - 3")).toEqual(["-", ["-", 10, 2], 3]);
    });

    it("does not flatten / chains (Mapbox's '/' only takes 2 args)", () => {
      expect(compileSrc("100 / 2 / 5")).toEqual(["/", ["/", 100, 2], 5]);
    });

    it("does not flatten % chains (Mapbox's '%' only takes 2 args)", () => {
      expect(compileSrc("10 % 3 % 2")).toEqual(["%", ["%", 10, 3], 2]);
    });

    it("does not flatten ^ chains (Mapbox's '^' only takes 2 args)", () => {
      // Also happens to be right-associative, so this nests the opposite
      // way from -, /, % -- the second operator is the outer one here.
      expect(compileSrc("2 ^ 3 ^ 2")).toEqual(["^", 2, ["^", 3, 2]]);
    });

    it("does not cross-flatten different operators", () => {
      // The "2 * 3" group must stay intact, not merge into the + chain.
      expect(compileSrc("1 + 2 * 3 + 4")).toEqual(["+", 1, ["*", 2, 3], 4]);
    });

    it("flattens a long chain fully, not just pairwise", () => {
      expect(compileSrc("1 + 1 + 1 + 1 + 1")).toEqual(["+", 1, 1, 1, 1, 1]);
    });
  });

  describe("get() / feature properties", () => {
    it("compiles a bare get() call", () => {
      expect(compileSrc('get("population")')).toEqual(["get", "population"]);
    });

    it("preserves a property name with characters invalid in a bare identifier", () => {
      expect(compileSrc('get("name:en")')).toEqual(["get", "name:en"]);
    });

    it("combines with arithmetic", () => {
      expect(compileSrc('get("population") + 1')).toEqual(["+", ["get", "population"], 1]);
    });

    it("is never treated as a compile-time constant, even with optimize on", () => {
      // Nothing to fold here -- must stay an expression array either way.
      expect(compileSrc('get("population") + 1')).toEqual(["+", ["get", "population"], 1]);
      expect(compileSrc('get("population") + 1', true)).toEqual(["+", ["get", "population"], 1]);
    });

    it("lets + flatten through it without mistaking its own array for a + chain", () => {
      // get(...) compiles to ["get", name] -- the flatten check must not
      // confuse that array with a "+"/"*" chain to splice into.
      expect(compileSrc('1 + get("a") + 2')).toEqual(["+", 1, ["get", "a"], 2]);
      expect(compileSrc('get("a") + get("b") + get("c")')).toEqual([
        "+",
        ["get", "a"],
        ["get", "b"],
        ["get", "c"],
      ]);
    });

    it("still folds the constant part of a mixed expression", () => {
      // The original motivating example for building optimize at all.
      expect(compileSrc('get("population_density") * (4 + 3)', true)).toEqual([
        "*",
        ["get", "population_density"],
        7,
      ]);
    });

    it("compiles under unary minus", () => {
      expect(compileSrc('-get("population")')).toEqual(["-", ["get", "population"]]);
    });

    it("compiles under the power operator on either side", () => {
      expect(compileSrc('get("population") ^ 2')).toEqual(["^", ["get", "population"], 2]);
      expect(compileSrc('2 ^ get("population")')).toEqual(["^", 2, ["get", "population"]]);
    });

    it("does not false-positive a division/modulo-by-zero check", () => {
      // Neither side is a known constant, so there's nothing to catch --
      // must not throw just because a get() call is present.
      expect(() => compileSrc('get("population") / get("density")')).not.toThrow();
      expect(() => compileSrc('get("a") % get("b")')).not.toThrow();
    });

    it("still catches a literal zero divisor when the other side is a get() call", () => {
      expect(() => compileSrc('get("population") / 0')).toThrow("Division by zero");
    });
  });

  describe("power operator", () => {
    it("compiles an ordinary power expression", () => {
      expect(compileSrc("2 ^ 10")).toEqual(["^", 2, 10]);
    });

    it("right-associativity changes the actual folded value, not just the shape", () => {
      // 2 ^ (3 ^ 2) = 2 ^ 9 = 512, but (2 ^ 3) ^ 2 = 8 ^ 2 = 64 -- these
      // are genuinely different numbers, so this proves associativity is
      // wired correctly end to end, not just structurally plausible.
      expect(compileSrc("2 ^ 3 ^ 2", true)).toBe(512);
      expect(compileSrc("(2 ^ 3) ^ 2", true)).toBe(64);
    });

    it("treats x ^ 0 as 1, not an error", () => {
      expect(compileSrc("2 ^ 0", true)).toBe(1);
    });
  });

  describe("constant folding (optimize: true)", () => {
    it("folds a simple binary expression to its value", () => {
      expect(compileSrc("1 + 2", true)).toBe(3);
    });

    it("folds through nested and grouped expressions", () => {
      expect(compileSrc("2 * (4 + 3)", true)).toBe(14);
    });

    it("folds unary minus directly to a negative literal", () => {
      expect(compileSrc("-5", true)).toBe(-5);
    });

    it("folds chained unary minus (double negation)", () => {
      expect(compileSrc("--5", true)).toBe(5);
    });

    it("folds a long chain to a single number", () => {
      expect(compileSrc("1 + 1 + 1 + 1 + 1", true)).toBe(5);
    });

    it("folds a modulo expression to its value", () => {
      expect(compileSrc("10 % 3", true)).toBe(1);
    });

    it("folds a power expression to its value", () => {
      expect(compileSrc("2 ^ 10", true)).toBe(1024);
    });

    it("does not fold when optimize is false (the default)", () => {
      expect(compileSrc("1 + 2")).toEqual(["+", 1, 2]);
      expect(compileSrc("1 + 2", false)).toEqual(["+", 1, 2]);
    });
  });

  describe("division by zero", () => {
    it("throws on a literal zero divisor", () => {
      expect(() => compileSrc("5 / 0")).toThrow(RuntimeError);
      expect(() => compileSrc("5 / 0")).toThrow("Division by zero");
    });

    it("throws on a zero divisor even without optimize, since constant tracking isn't optional", () => {
      expect(() => compileSrc("1 / (2 - 2)", false)).toThrow(RuntimeError);
    });

    it("throws on a zero divisor with optimize on too", () => {
      expect(() => compileSrc("1 / (2 - 2)", true)).toThrow(RuntimeError);
    });

    it("does not throw for an ordinary non-zero division", () => {
      expect(() => compileSrc("5 / 2")).not.toThrow();
      expect(compileSrc("5 / 2")).toEqual(["/", 5, 2]);
    });

    it("points the error at the divisor, not the whole expression", () => {
      try {
        compileSrc("5 / 0");
        throw new Error("expected compileSrc() to throw, but it didn't");
      } catch (error) {
        if (!(error instanceof RuntimeError)) throw error;
        // "5 / 0": '0' is at index 4.
        expect(error.posStart).toMatchObject({ idx: 4, ln: 0, col: 4 });
        expect(error.posEnd).toMatchObject({ idx: 5, ln: 0, col: 5 });
      }
    });
  });

  describe("modulo by zero", () => {
    it("throws on a literal zero divisor", () => {
      expect(() => compileSrc("5 % 0")).toThrow(RuntimeError);
      expect(() => compileSrc("5 % 0")).toThrow("Modulo by zero");
    });

    it("throws on a zero divisor even without optimize, since constant tracking isn't optional", () => {
      expect(() => compileSrc("1 % (2 - 2)", false)).toThrow(RuntimeError);
    });

    it("throws on a zero divisor with optimize on too", () => {
      expect(() => compileSrc("1 % (2 - 2)", true)).toThrow(RuntimeError);
    });

    it("does not throw for an ordinary non-zero modulo", () => {
      expect(() => compileSrc("5 % 2")).not.toThrow();
      expect(compileSrc("5 % 2")).toEqual(["%", 5, 2]);
    });

    it("points the error at the divisor, not the whole expression", () => {
      try {
        compileSrc("5 % 0");
        throw new Error("expected compileSrc() to throw, but it didn't");
      } catch (error) {
        if (!(error instanceof RuntimeError)) throw error;
        // "5 % 0": '0' is at index 4.
        expect(error.posStart).toMatchObject({ idx: 4, ln: 0, col: 4 });
        expect(error.posEnd).toMatchObject({ idx: 5, ln: 0, col: 5 });
      }
    });
  });

  describe("non-finite results (mainly from ^)", () => {
    it("throws when the result overflows to Infinity", () => {
      expect(() => compileSrc("0 ^ -1", true)).toThrow(RuntimeError);
      expect(() => compileSrc("0 ^ -1", true)).toThrow("Result is not a finite number: Infinity");
    });

    it("throws even without optimize, since constant tracking isn't optional", () => {
      expect(() => compileSrc("0 ^ -1", false)).toThrow(RuntimeError);
    });

    it("throws when the result is NaN (negative base, fractional exponent)", () => {
      expect(() => compileSrc("(-4) ^ 0.5", true)).toThrow(RuntimeError);
      expect(() => compileSrc("(-4) ^ 0.5", true)).toThrow("Result is not a finite number: NaN");
    });

    it("throws on plain numeric overflow", () => {
      expect(() => compileSrc("10 ^ 1000", true)).toThrow(RuntimeError);
    });

    it("does not throw for an ordinary power expression", () => {
      expect(() => compileSrc("2 ^ 10", true)).not.toThrow();
    });

    it("points the error at the whole expression, not just one operand", () => {
      // Unlike division/modulo by zero, there isn't one operand clearly
      // "at fault" here, so this blames the full BinOpNode span instead.
      try {
        compileSrc("0 ^ -1", true);
        throw new Error("expected compileSrc() to throw, but it didn't");
      } catch (error) {
        if (!(error instanceof RuntimeError)) throw error;
        // "0 ^ -1": spans the whole expression, index 0 to 6.
        expect(error.posStart).toMatchObject({ idx: 0, ln: 0, col: 0 });
        expect(error.posEnd).toMatchObject({ idx: 6, ln: 0, col: 6 });
      }
    });
  });
});
