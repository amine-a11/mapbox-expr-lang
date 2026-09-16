import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { Compiler, type MapboxExpression } from "../../src/compiler/compiler";
import { RuntimeError } from "../../src/errors/langError";

function compileSrc(source: string): MapboxExpression {
  const tokens = new Lexer(source).makeToken();
  const ast = new Parser(tokens, source).parse();
  return new Compiler(source).compile(ast);
}

describe("Compiler variables", () => {
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
});
