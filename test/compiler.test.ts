import { describe, expect, it } from "vitest";
import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { Compiler, type MapboxExpression } from "../src/compiler/compiler";

function compileSrc(source: string): MapboxExpression {
  const tokens = new Lexer(source).makeToken();
  const ast = new Parser(tokens, source).parse();
  return new Compiler().compile(ast);
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

  describe("boolean literals", () => {
    it("compiles 'true' to a real boolean, not 1", () => {
      const result = compileSrc("true");
      expect(result).toBe(true);
      expect(typeof result).toBe("boolean");
    });

    it("compiles 'false' to a real boolean, not 0", () => {
      const result = compileSrc("false");
      expect(result).toBe(false);
      expect(typeof result).toBe("boolean");
    });

    it("does not error when a boolean literal is used in arithmetic", () => {
      // The video's language treats True/False as 1/0, but Mapbox's boolean
      // type is its own literal value kind, never a number substitute. This
      // still has to compile without throwing -- Mapbox itself will reject
      // ["+", true, 2] at evaluation time, but that's not this stage's job.
      expect(compileSrc("true + 2")).toEqual(["+", true, 2]);
      expect(compileSrc("false * 3")).toEqual(["*", false, 3]);
    });

    it("combines with comparisons and boolean operators", () => {
      expect(compileSrc("true and false")).toEqual(["all", true, false]);
      expect(compileSrc("true or false")).toEqual(["any", true, false]);
      expect(compileSrc("not true")).toEqual(["!", true]);
      expect(compileSrc("true == false")).toEqual(["==", true, false]);
    });

    it("combines with get() and unary minus", () => {
      expect(compileSrc('get("active") and true')).toEqual(["all", ["get", "active"], true]);
      expect(compileSrc("-true")).toEqual(["-", true]);
    });
  });

  describe("binary operators", () => {
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

  describe("unary operators", () => {
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

    it("is never treated as a compile-time constant", () => {
      expect(compileSrc('get("population") + 1')).toEqual(["+", ["get", "population"], 1]);
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

    it("leaves the constant part of a mixed expression unfolded", () => {
      // There's no constant folding at this stage -- "(4 + 3)" stays a
      // nested expression array rather than collapsing to 7.
      expect(compileSrc('get("population_density") * (4 + 3)')).toEqual([
        "*",
        ["get", "population_density"],
        ["+", 4, 3],
      ]);
    });

    it("compiles under unary minus", () => {
      expect(compileSrc('-get("population")')).toEqual(["-", ["get", "population"]]);
    });

    it("compiles under the power operator on either side", () => {
      expect(compileSrc('get("population") ^ 2')).toEqual(["^", ["get", "population"], 2]);
      expect(compileSrc('2 ^ get("population")')).toEqual(["^", 2, ["get", "population"]]);
    });
  });

  describe("power operator", () => {
    it("compiles an ordinary power expression", () => {
      expect(compileSrc("2 ^ 10")).toEqual(["^", 2, 10]);
    });

    it("is right-associative, producing a structurally different tree than the explicitly left-grouped form", () => {
      expect(compileSrc("2 ^ 3 ^ 2")).toEqual(["^", 2, ["^", 3, 2]]);
      expect(compileSrc("(2 ^ 3) ^ 2")).toEqual(["^", ["^", 2, 3], 2]);
    });

    it("compiles x ^ 0 without folding or erroring", () => {
      expect(compileSrc("2 ^ 0")).toEqual(["^", 2, 0]);
    });
  });

  describe("no runtime value validation yet (deferred until the language itself is done)", () => {
    // The compiler is a pure structural translation right now -- it never
    // looks at what a subtree would evaluate to, so nothing here throws,
    // even cases Mapbox would reject at evaluation time (e.g. actual
    // division by zero). Checks like these are planned for later, once the
    // core language is finished.
    it("compiles a literal zero divisor without throwing", () => {
      expect(compileSrc("5 / 0")).toEqual(["/", 5, 0]);
    });

    it("compiles a computed zero divisor without throwing", () => {
      expect(compileSrc("1 / (2 - 2)")).toEqual(["/", 1, ["-", 2, 2]]);
    });

    it("compiles a zero modulo divisor without throwing", () => {
      expect(compileSrc("5 % 0")).toEqual(["%", 5, 0]);
    });

    it("compiles a power expression that would overflow or produce NaN without throwing", () => {
      expect(compileSrc("0 ^ -1")).toEqual(["^", 0, ["-", 1]]);
      expect(compileSrc("(-4) ^ 0.5")).toEqual(["^", ["-", 4], 0.5]);
    });
  });

  describe("comparison operators", () => {
    it.each([
      ["==", "1 == 2", ["==", 1, 2]],
      ["!=", "1 != 2", ["!=", 1, 2]],
      ["<", "1 < 2", ["<", 1, 2]],
      ["<=", "1 <= 2", ["<=", 1, 2]],
      [">", "1 > 2", [">", 1, 2]],
      [">=", "1 >= 2", [">=", 1, 2]],
    ] as const)("compiles %s to a Mapbox expression array", (_op, source, expected) => {
      expect(compileSrc(source)).toEqual(expected);
    });

    it("does not fold to a boolean -- comparisons always stay expression arrays", () => {
      expect(compileSrc("1 == 2")).toEqual(["==", 1, 2]);
      expect(compileSrc("1 < 2")).toEqual(["<", 1, 2]);
    });

    it("leaves arithmetic on either side of a comparison unfolded", () => {
      expect(compileSrc("1 + 2 == 3 * 1")).toEqual(["==", ["+", 1, 2], ["*", 3, 1]]);
    });

    it("does not flatten chained comparisons (not variadic in Mapbox)", () => {
      expect(compileSrc("1 == 2 == 3")).toEqual(["==", ["==", 1, 2], 3]);
    });

    it("combines with get()", () => {
      expect(compileSrc('get("speed") >= 100')).toEqual([">=", ["get", "speed"], 100]);
    });
  });

  describe("boolean operators (and/or/not)", () => {
    it("compiles 'and' to Mapbox's variadic 'all'", () => {
      expect(compileSrc("1 and 2")).toEqual(["all", 1, 2]);
    });

    it("compiles 'or' to Mapbox's variadic 'any'", () => {
      expect(compileSrc("1 or 2")).toEqual(["any", 1, 2]);
    });

    it("compiles 'not' to Mapbox's single-argument '!'", () => {
      expect(compileSrc("not 1")).toEqual(["!", 1]);
    });

    it("chains multiple 'not' without collapsing them", () => {
      expect(compileSrc("not not 1")).toEqual(["!", ["!", 1]]);
    });

    it("flattens a chain of 'and' into one variadic array", () => {
      expect(compileSrc("1 and 2 and 3")).toEqual(["all", 1, 2, 3]);
    });

    it("flattens a chain of 'or' into one variadic array", () => {
      expect(compileSrc("1 or 2 or 3")).toEqual(["any", 1, 2, 3]);
    });

    it("does not cross-flatten 'and' into 'or' or vice versa", () => {
      // "and"/"or" are equal precedence in this grammar (left-associative),
      // so this parses as (1 and 2) or 3 -- the "all" group must stay
      // intact as a single argument to "any", not merge into it.
      expect(compileSrc("1 and 2 or 3")).toEqual(["any", ["all", 1, 2], 3]);
    });

    it("combines comparisons and boolean logic across precedence levels", () => {
      expect(compileSrc("1 == 2 and 3 < 4")).toEqual(["all", ["==", 1, 2], ["<", 3, 4]]);
    });
  });
});
