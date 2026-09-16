import { describe, expect, it } from "vitest";
import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { Compiler, type MapboxExpression } from "../src/compiler/compiler";
import { RuntimeError, TypeMismatchError } from "../src/errors/langError";

function compileSrc(source: string): MapboxExpression {
  const tokens = new Lexer(source).makeToken();
  const ast = new Parser(tokens, source).parse();
  return new Compiler(source).compile(ast);
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

  describe("string literals", () => {
    it("compiles a double-quoted or single-quoted string to a raw JS string", () => {
      expect(compileSrc('"red"')).toBe("red");
      expect(compileSrc("'red'")).toBe("red");
    });

    it("compiles an empty string", () => {
      expect(compileSrc('""')).toBe("");
    });

    it("preserves characters that aren't valid in a bare identifier", () => {
      expect(compileSrc('"name:en"')).toBe("name:en");
    });

    it("is not wrapped in a 'literal' expression -- a bare string is already a valid value", () => {
      const result = compileSrc('"red"');
      expect(Array.isArray(result)).toBe(false);
    });

    it("combines with comparisons, get(), and if expressions", () => {
      expect(compileSrc('"road" == "water"')).toEqual(["==", "road", "water"]);
      expect(compileSrc('get("type") == "road"')).toEqual(["==", ["get", "type"], "road"]);
      expect(compileSrc('if get("type") == "road" then "red" else "blue"')).toEqual([
        "case",
        ["==", ["get", "type"], "road"],
        "red",
        "blue",
      ]);
    });

    it("is usable as the value of a variable assignment", () => {
      expect(compileSrc('var color = "red"\ncolor')).toEqual([
        "let",
        "color",
        "red",
        ["var", "color"],
      ]);
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
      expect(compileSrc("true and false")).toEqual(["all", true, false]);
    });

    it("compiles 'or' to Mapbox's variadic 'any'", () => {
      expect(compileSrc("true or false")).toEqual(["any", true, false]);
    });

    it("compiles 'not' to Mapbox's single-argument '!'", () => {
      expect(compileSrc("not true")).toEqual(["!", true]);
    });

    it("chains multiple 'not' without collapsing them", () => {
      expect(compileSrc("not not true")).toEqual(["!", ["!", true]]);
    });

    it("flattens a chain of 'and' into one variadic array", () => {
      expect(compileSrc("true and false and true")).toEqual(["all", true, false, true]);
    });

    it("flattens a chain of 'or' into one variadic array", () => {
      expect(compileSrc("true or false or true")).toEqual(["any", true, false, true]);
    });

    it("does not cross-flatten 'and' into 'or' or vice versa", () => {
      expect(compileSrc("true and false or true")).toEqual(["any", ["all", true, false], true]);
    });

    it("combines comparisons and boolean logic across precedence levels", () => {
      expect(compileSrc("1 == 2 and 3 < 4")).toEqual(["all", ["==", 1, 2], ["<", 3, 4]]);
    });
  });

  describe("boolean type checking for and/or/not/if", () => {
    it("rejects a number operand to 'and'", () => {
      expect(() => compileSrc("1 and 2")).toThrow(TypeMismatchError);
      expect(() => compileSrc("1 and 2")).toThrow(
        "'and' requires a boolean operand, but this is a number",
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

    it("rejects a string condition in an if/elif", () => {
      expect(() => compileSrc('if "hello" then 1 else 2')).toThrow(
        "'if'/'elif' condition must be a boolean, but this is a string",
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

    it("rejects an arithmetic expression, not just a literal number", () => {
      expect(() => compileSrc("(1 + 2) and true")).toThrow(
        "'and' requires a boolean operand, but this is a number",
      );
      expect(() => compileSrc("not (3 * 4)")).toThrow(
        "'not' requires a boolean operand, but this is a number",
      );
    });

    it("rejects a number condition in an if/elif", () => {
      expect(() => compileSrc("if 1 then 1 else 2")).toThrow(
        "'if'/'elif' condition must be a boolean, but this is a number",
      );
      expect(() => compileSrc("if 1 > 0 then 1 elif 5 then 2 else 3")).toThrow(
        "'if'/'elif' condition must be a boolean, but this is a number",
      );
    });

    it("allows comparisons, booleans, and nested and/or/not as operands", () => {
      expect(() => compileSrc("(1 > 2) and (3 < 4)")).not.toThrow();
      expect(() => compileSrc("true and false")).not.toThrow();
      expect(() => compileSrc("not (1 > 2)")).not.toThrow();
    });

    it("allows a string as a comparison operand (only and/or/not/if reject strings)", () => {
      expect(() => compileSrc('("road" == "water") and true')).not.toThrow();
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

  describe("variables", () => {
    it("compiles a simple assignment to a 'let' that reads its own value back", () => {
      expect(compileSrc("var a = 5")).toEqual(["let", "a", 5, ["var", "a"]]);
    });

    it("compiles the value as an arbitrary expression", () => {
      expect(compileSrc("var a = 1 + 2")).toEqual(["let", "a", ["+", 1, 2], ["var", "a"]]);
    });

    it("rejects a variable assignment used as the value of another", () => {
      expect(() => compileSrc("var a = var b = 5")).toThrow("Unexpected token: KEYWORD:var");
    });

    it("rejects a variable assignment nested inside an ordinary expression", () => {
      expect(() => compileSrc("1 + (var x = 5)")).toThrow("Unexpected token: KEYWORD:var");
    });

    it("combines with get()", () => {
      expect(compileSrc('var speed = get("speed")')).toEqual([
        "let",
        "speed",
        ["get", "speed"],
        ["var", "speed"],
      ]);
    });

    it("throws when reading a variable that was never assigned", () => {
      expect(() => compileSrc("a")).toThrow(RuntimeError);
      expect(() => compileSrc("a")).toThrow('Variable "a" is not defined');
      expect(() => compileSrc("a + 1")).toThrow('Variable "a" is not defined');
    });

    it("throws when a variable references itself in its own initializer", () => {
      expect(() => compileSrc("var a = a + 1")).toThrow('Variable "a" is not defined');
    });

    it("points the error at the identifier, not the whole expression", () => {
      try {
        compileSrc("var b = 5\na + 1");
        throw new Error("expected compileSrc() to throw, but it didn't");
      } catch (error) {
        if (!(error instanceof RuntimeError)) throw error;
        expect(error.posStart).toMatchObject({ idx: 10, ln: 1, col: 0 });
        expect(error.posEnd).toMatchObject({ idx: 11, ln: 1, col: 1 });
      }
    });
  });

  describe("statement sequences (multiple lines)", () => {
    it("makes a variable usable on every later line, not just its own body", () => {
      expect(compileSrc("var a = 5\na + 1")).toEqual(["let", "a", 5, ["+", ["var", "a"], 1]]);
    });

    it("chains three variables across lines, each seeing the ones before it", () => {
      expect(compileSrc("var a = 1\nvar b = a + 1\nvar c = a + b\nc")).toEqual([
        "let",
        "a",
        1,
        [
          "let",
          "b",
          ["+", ["var", "a"], 1],
          ["let", "c", ["+", ["var", "a"], ["var", "b"]], ["var", "c"]],
        ],
      ]);
    });

    it("shadowing across lines reads the OUTER value while computing the new one", () => {
      expect(compileSrc("var a = 10\nvar a = a + 5\na")).toEqual([
        "let",
        "a",
        10,
        ["let", "a", ["+", ["var", "a"], 5], ["var", "a"]],
      ]);
    });

    it("rejects a non-'var' statement that isn't the last one, before it ever tries to compile further", () => {
      expect(() => compileSrc("5 + 3\nvar a = 1")).toThrow("This expression's value is unused");
    });

    it("tolerates blank lines between statements", () => {
      expect(compileSrc("var a = 5\n\n\nvar b = a + 1\n\nb")).toEqual([
        "let",
        "a",
        5,
        ["let", "b", ["+", ["var", "a"], 1], ["var", "b"]],
      ]);
    });

    it("combines get(), comparisons, variables, and boolean operators across lines", () => {
      const source = `
        var speed = get("speed")
        var isFast = speed > 100

        isFast and true
      `;
      expect(compileSrc(source)).toEqual([
        "let",
        "speed",
        ["get", "speed"],
        ["let", "isFast", [">", ["var", "speed"], 100], ["all", ["var", "isFast"], true]],
      ]);
    });
  });

  describe("flattening independent 'var' statements into one 'let'", () => {
    it("flattens three mutually independent variables into one 'let'", () => {
      expect(compileSrc("var a = 5\nvar b = 10\nvar c = 20\na + b + c")).toEqual([
        "let",
        "a",
        5,
        "b",
        10,
        "c",
        20,
        ["+", ["var", "a"], ["var", "b"], ["var", "c"]],
      ]);
    });

    it("compiles the user's original motivating example this way", () => {
      const source = `
        var a = 1 + 2 + get("population_density")
        var b = (1 + 2 + 2 + 3) / 3

        a * b
      `;
      expect(compileSrc(source)).toEqual([
        "let",
        "a",
        ["+", 1, 2, ["get", "population_density"]],
        "b",
        ["/", ["+", 1, 2, 2, 3], 3],
        ["*", ["var", "a"], ["var", "b"]],
      ]);
    });

    it("does not flatten when a later variable depends on an earlier one", () => {
      expect(compileSrc("var a = 1\nvar b = a + 1\nb")).toEqual([
        "let",
        "a",
        1,
        ["let", "b", ["+", ["var", "a"], 1], ["var", "b"]],
      ]);
    });

    it("flattens the independent prefix, then nests once a dependency appears, then flattens again after", () => {
      const source = `
        var a = 1
        var b = 2
        var c = a + b
        var d = 5

        a + b + c + d
      `;
      expect(compileSrc(source)).toEqual([
        "let",
        "a",
        1,
        "b",
        2,
        [
          "let",
          "c",
          ["+", ["var", "a"], ["var", "b"]],
          "d",
          5,
          ["+", ["var", "a"], ["var", "b"], ["var", "c"], ["var", "d"]],
        ],
      ]);
    });

    it("does not flatten a variable that shadows an earlier one with the same name", () => {
      expect(compileSrc("var a = 10\nvar a = a + 5\na")).toEqual([
        "let",
        "a",
        10,
        ["let", "a", ["+", ["var", "a"], 5], ["var", "a"]],
      ]);
    });

    it("still rejects a non-'var' statement that isn't last, even mid-flattenable-run", () => {
      expect(() => compileSrc("var a = 1\nvar b = 2\nb\na")).toThrow(
        "This expression's value is unused",
      );
    });
  });

  describe("if expressions", () => {
    it("compiles a single if/then/else to a 'case' with a fallback", () => {
      expect(compileSrc("if 1 > 0 then 1 else 2")).toEqual(["case", [">", 1, 0], 1, 2]);
    });

    it("compiles if/elif/then/else to a 'case' with multiple condition/output pairs", () => {
      expect(compileSrc("if 1 > 5 then 1 elif 1 > 0 then 2 else 3")).toEqual([
        "case",
        [">", 1, 5],
        1,
        [">", 1, 0],
        2,
        3,
      ]);
    });

    it("compiles several elif branches to one flat 'case', not nested cases", () => {
      expect(compileSrc("if 1 > 9 then 1 elif 1 > 5 then 2 elif 1 > 0 then 3 else 4")).toEqual([
        "case",
        [">", 1, 9],
        1,
        [">", 1, 5],
        2,
        [">", 1, 0],
        3,
        4,
      ]);
    });

    it("combines with get(), variables, and boolean operators in conditions and branches", () => {
      expect(compileSrc('if get("speed") > 100 then true else false')).toEqual([
        "case",
        [">", ["get", "speed"], 100],
        true,
        false,
      ]);
    });

    it("compiles as the value of a variable assignment", () => {
      expect(compileSrc("var x = if 1 > 0 then 1 else 2\nx + 1")).toEqual([
        "let",
        "x",
        ["case", [">", 1, 0], 1, 2],
        ["+", ["var", "x"], 1],
      ]);
    });

    it("nests correctly when one branch is itself an if expression", () => {
      expect(compileSrc("if 1 > 0 then (if 2 > 0 then 1 else 2) else 3")).toEqual([
        "case",
        [">", 1, 0],
        ["case", [">", 2, 0], 1, 2],
        3,
      ]);
    });

    it("does not flatten a variable whose if-condition depends on an earlier variable", () => {
      expect(compileSrc("var a = 5\nvar b = if a > 0 then 1 else 2\na + b")).toEqual([
        "let",
        "a",
        5,
        ["let", "b", ["case", [">", ["var", "a"], 0], 1, 2], ["+", ["var", "a"], ["var", "b"]]],
      ]);
    });

    it("does not flatten a variable whose if-branch value depends on an earlier variable", () => {
      expect(compileSrc("var a = 5\nvar b = if true then a else 0\nb")).toEqual([
        "let",
        "a",
        5,
        ["let", "b", ["case", true, ["var", "a"], 0], ["var", "b"]],
      ]);
    });

    it("flattens a variable whose if expression doesn't reference any earlier one", () => {
      expect(compileSrc("var a = 5\nvar b = if 1 > 0 then 1 else 2\na + b")).toEqual([
        "let",
        "a",
        5,
        "b",
        ["case", [">", 1, 0], 1, 2],
        ["+", ["var", "a"], ["var", "b"]],
      ]);
    });
  });
});
