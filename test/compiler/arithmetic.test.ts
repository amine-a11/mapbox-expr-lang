import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { Compiler, type MapboxExpression } from "../../src/compiler/compiler";

function compileSrc(source: string): MapboxExpression {
  const tokens = new Lexer(source).makeToken();
  const ast = new Parser(tokens, source).parse();
  return new Compiler(source).compile(ast);
}

describe("Compiler arithmetic", () => {
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
});
