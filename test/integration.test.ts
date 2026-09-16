import { describe, expect, it } from "vitest";
import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { Compiler, type MapboxExpression } from "../src/compiler/compiler";
import { RuntimeError, TypeMismatchError } from "../src/errors/langError";

// Realistic, multi-feature programs exercising the full lexer -> parser ->
// compiler pipeline together, rather than one feature in isolation. Every
// expected value below was cross-checked against the real evaluator
// (@maplibre/maplibre-gl-style-spec, in a throwaway scratch sandbox, not a
// project dependency) with representative feature data, not just asserted
// to be internally consistent.
function compileSrc(source: string): MapboxExpression {
  const tokens = new Lexer(source).makeToken();
  const ast = new Parser(tokens, source).parse();
  return new Compiler(source).compile(ast);
}

describe("Integration: combined multi-feature programs", () => {
  it("road color by type and speed: variables, comparisons, and/or, if/elif, and a match fallback together", () => {
    const source = `
      var type = get("type")
      var speed = get("speed")
      var isHighway = type == "highway" and speed > 80

      if isHighway then
        "red"
      elif type == "residential" then
        "blue"
      else
        match type
          "path", "track" then "green"
          "water" then "cyan"
          else "gray"
    `;

    expect(compileSrc(source)).toEqual([
      "let",
      "type",
      ["get", "type"],
      "speed",
      ["get", "speed"],
      [
        "let",
        "isHighway",
        ["all", ["==", ["var", "type"], "highway"], [">", ["var", "speed"], 80]],
        [
          "case",
          ["var", "isHighway"],
          "red",
          ["==", ["var", "type"], "residential"],
          "blue",
          ["match", ["var", "type"], ["path", "track"], "green", "water", "cyan", "gray"],
        ],
      ],
    ]);
  });

  it("population density scale: division feeding a chain of if/elif comparisons", () => {
    const source = `
      var density = get("population") / get("area")
      if density > 1000 then
        "very dense"
      elif density > 500 then
        "dense"
      elif density > 100 then
        "moderate"
      else
        "sparse"
    `;

    expect(compileSrc(source)).toEqual([
      "let",
      "density",
      ["/", ["get", "population"], ["get", "area"]],
      [
        "case",
        [">", ["var", "density"], 1000],
        "very dense",
        [">", ["var", "density"], 500],
        "dense",
        [">", ["var", "density"], 100],
        "moderate",
        "sparse",
      ],
    ]);
  });

  it("a comparison-derived variable feeds both 'and' and a later match comparison", () => {
    const source = `
      var isUrban = get("population") > 10000
      var category = match get("type")
        "city", "town" then "urban"
        else "rural"
      isUrban and category == "urban"
    `;

    expect(compileSrc(source)).toEqual([
      "let",
      "isUrban",
      [">", ["get", "population"], 10000],
      "category",
      ["match", ["get", "type"], ["city", "town"], "urban", "rural"],
      ["all", ["var", "isUrban"], ["==", ["var", "category"], "urban"]],
    ]);
  });

  it("'let'-flattening sees through to outer variables: b, c, and d all depend only on the outer 'a', so they flatten together", () => {
    // "a" forces its own "let" (b's value references it), but b, c, and d
    // only ever reference "a" (already outer and closed by the time their
    // own batch starts) or nothing at all -- never each other -- so they
    // correctly share one flat "let", even with an if and a match mixed in.
    const source = `
      var a = 5
      var b = if a > 0 then 1 else 2
      var c = match a
        5 then "five"
        else "other"
      var d = 10
      a + b + d
    `;

    expect(compileSrc(source)).toEqual([
      "let",
      "a",
      5,
      [
        "let",
        "b",
        ["case", [">", ["var", "a"], 0], 1, 2],
        "c",
        ["match", ["var", "a"], 5, "five", "other"],
        "d",
        10,
        ["+", ["var", "a"], ["var", "b"], ["var", "d"]],
      ],
    ]);
  });

  it("a type error deep inside a match arm, nested inside a variable, still reports the exact offending token", () => {
    const source = `
      var a = 5
      var b = match get("type")
        "x" then a and 1
        else "y"
      b
    `;

    expect(() => compileSrc(source)).toThrow(TypeMismatchError);
    expect(() => compileSrc(source)).toThrow(
      "'and' requires a boolean operand, but this is a number",
    );

    try {
      compileSrc(source);
      throw new Error("expected compileSrc() to throw, but it didn't");
    } catch (error) {
      if (!(error instanceof TypeMismatchError)) throw error;
      // The "1" in "a and 1" is on the fourth line of the template literal.
      expect(error.posStart).toMatchObject({ ln: 3, col: 23 });
    }
  });

  it("an undefined variable deep inside an if/match chain is still caught, even though everything around it is otherwise valid", () => {
    const source = `
      var a = 5
      if a > 0 then
        match a
          5 then unknownVar
          else "other"
      else
        "negative"
    `;

    expect(() => compileSrc(source)).toThrow(RuntimeError);
    expect(() => compileSrc(source)).toThrow('Variable "unknownVar" is not defined');
  });

  it("shadowing combined with if/match: the inner 'category' shadow only ever sees the outer value while computing itself", () => {
    const source = `
      var category = "unknown"
      var category = if get("verified") then match get("type") "car" then "vehicle" else "other" else category
      category
    `;

    expect(compileSrc(source)).toEqual([
      "let",
      "category",
      "unknown",
      [
        "let",
        "category",
        [
          "case",
          ["get", "verified"],
          ["match", ["get", "type"], "car", "vehicle", "other"],
          ["var", "category"],
        ],
        ["var", "category"],
      ],
    ]);
  });

  it("zoom-dependent circle radius: a namespaced constant combined with arithmetic and min/max clamping", () => {
    const source = `
      var base = get("population") / 1000
      min(20, max(4, base + camera.zoom / 2))
    `;

    expect(compileSrc(source)).toEqual([
      "let",
      "base",
      ["/", ["get", "population"], 1000],
      ["min", 20, ["max", 4, ["+", ["var", "base"], ["/", ["zoom"], 2]]]],
    ]);
  });

  it("zoom-dependent building color: step for a discrete palette, interpolate for a smooth height-based radius", () => {
    const source = `
      var heightCategory = step get("height")
        default "low"
        50  then "mid"
        200 then "high"

      var radius = interpolate exponential(1.5) camera.zoom
        5  then 2
        15 then 20

      match heightCategory
        "high" then rgb(200, 0, 0)
        "mid" then rgb(0, 200, 0)
        else rgb(0, 0, 200)
    `;

    expect(compileSrc(source)).toEqual([
      "let",
      "heightCategory",
      ["step", ["get", "height"], "low", 50, "mid", 200, "high"],
      "radius",
      ["interpolate", ["exponential", 1.5], ["zoom"], 5, 2, 15, 20],
      [
        "match",
        ["var", "heightCategory"],
        "high",
        ["rgb", 200, 0, 0],
        "mid",
        ["rgb", 0, 200, 0],
        ["rgb", 0, 0, 200],
      ],
    ]);
  });

  it("a type error inside an interpolate stop's output is still caught with the exact offending token", () => {
    const source = `
      interpolate linear camera.zoom
        0  then 1 + true
        10 then 2
    `;

    expect(() => compileSrc(source)).toThrow(TypeMismatchError);
    expect(() => compileSrc(source)).toThrow(
      "'+' requires a numeric operand, but this is a boolean",
    );
  });

  it("circle radius and color: math functions, min/max clamping, and a boolean-returning function feeding an if", () => {
    const source = `
      var density = get("population") / get("area")
      var radius = min(50, max(5, sqrt(density)))
      if toBoolean(get("highlighted")) then rgb(255, 0, 0) else rgba(0, 0, 255, 0.5)
    `;

    expect(compileSrc(source)).toEqual([
      "let",
      "density",
      ["/", ["get", "population"], ["get", "area"]],
      [
        "let",
        "radius",
        ["min", 50, ["max", 5, ["sqrt", ["var", "density"]]]],
        [
          "case",
          ["to-boolean", ["get", "highlighted"]],
          ["rgb", 255, 0, 0],
          ["rgba", 0, 0, 255, 0.5],
        ],
      ],
    ]);
  });
});
