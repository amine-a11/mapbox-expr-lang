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

describe("Compiler namespaced constants", () => {
  it.each([
    ["math.e", ["e"]],
    ["math.pi", ["pi"]],
    ["math.ln2", ["ln2"]],
    ["camera.zoom", ["zoom"]],
    ["feature.id", ["id"]],
    ["feature.geometryType", ["geometry-type"]],
    ["feature.lineProgress", ["line-progress"]],
    ["feature.properties", ["properties"]],
    ["feature.accumulated", ["accumulated"]],
    ["heatmap.density", ["heatmap-density"]],
  ] as const)("compiles %s to Mapbox's operator of the same name", (source, expected) => {
    expect(compileSrc(source)).toEqual(expected);
  });

  it("combines with arithmetic like any other atom", () => {
    expect(compileSrc("math.e + 1")).toEqual(["+", ["e"], 1]);
  });

  it("is usable as the value of a variable assignment", () => {
    expect(compileSrc("var x = math.e\nx + 1")).toEqual([
      "let",
      "x",
      ["e"],
      ["+", ["var", "x"], 1],
    ]);
  });

  describe("errors", () => {
    it("rejects an unknown member under a known namespace", () => {
      expect(() => compileSrc("math.foo")).toThrow(RuntimeError);
      expect(() => compileSrc("math.foo")).toThrow('Unknown constant "math.foo"');
    });

    it("rejects an unknown namespace entirely", () => {
      expect(() => compileSrc("bogus.thing")).toThrow(RuntimeError);
      expect(() => compileSrc("bogus.thing")).toThrow('Unknown constant "bogus.thing"');
    });

    it("rejects operators Mapbox itself documents but MapLibre doesn't implement", () => {
      // Verified against the real evaluator (@maplibre/maplibre-gl-style-spec):
      // "pitch" and "distance-from-center" are both "Unknown expression"
      // there, even though they're real, documented Mapbox Camera operators
      // -- the same kind of Mapbox/MapLibre divergence already found for
      // random/hsl/hsla, so they're deliberately left out of CONSTANTS.
      expect(() => compileSrc("camera.pitch")).toThrow('Unknown constant "camera.pitch"');
      expect(() => compileSrc("camera.distanceFromCenter")).toThrow(
        'Unknown constant "camera.distanceFromCenter"',
      );
    });
  });

  describe("interaction with boolean type checking", () => {
    it("rejects a number-returning constant as an and/or/not operand", () => {
      expect(() => compileSrc("math.e and true")).toThrow(TypeMismatchError);
      expect(() => compileSrc("math.e and true")).toThrow(
        "'and' requires a boolean operand, but this is a number",
      );
    });

    it("rejects an object-returning constant as an if condition", () => {
      expect(() => compileSrc("if feature.properties then 1 else 2")).toThrow(
        "'if'/'elif' condition must be a boolean, but this is an object",
      );
    });

    it("allows feature.id, since its type can't be known statically", () => {
      expect(() => compileSrc("feature.id and true")).not.toThrow();
    });
  });

  describe("interaction with 'let' flattening", () => {
    it("flattens a variable whose value is a constant access, since it never references another variable", () => {
      expect(compileSrc("var a = 5\nvar b = math.e\na + b")).toEqual([
        "let",
        "a",
        5,
        "b",
        ["e"],
        ["+", ["var", "a"], ["var", "b"]],
      ]);
    });
  });
});
