import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { Compiler, type MapboxExpression } from "../../src/compiler/compiler";

function compileSrc(source: string): MapboxExpression {
  const tokens = new Lexer(source).makeToken();
  const ast = new Parser(tokens, source).parse();
  return new Compiler(source).compile(ast);
}

describe("Compiler literals", () => {
  describe("numbers", () => {
    it("compiles an integer to a raw number", () => {
      expect(compileSrc("42")).toBe(42);
    });

    it("compiles a float to a raw number", () => {
      expect(compileSrc("3.14")).toBe(3.14);
    });
  });

  describe("strings", () => {
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

  describe("booleans", () => {
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
});
