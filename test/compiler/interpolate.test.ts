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

describe("Compiler interpolate/step", () => {
  describe("interpolate", () => {
    it("compiles a linear interpolation", () => {
      expect(
        compileSrc(`interpolate linear camera.zoom
  5 then 10
  10 then 40`),
      ).toEqual(["interpolate", ["linear"], ["zoom"], 5, 10, 10, 40]);
    });

    it("compiles an exponential interpolation with its base", () => {
      expect(
        compileSrc(`interpolate exponential(2) camera.zoom
  0 then 0
  10 then 100`),
      ).toEqual(["interpolate", ["exponential", 2], ["zoom"], 0, 0, 10, 100]);
    });

    it("compiles a cubic-bezier interpolation with its four control points", () => {
      expect(
        compileSrc(`interpolate cubicBezier(0.42, 0, 1, 1) camera.zoom
  0 then 0
  10 then 100`),
      ).toEqual(["interpolate", ["cubic-bezier", 0.42, 0, 1, 1], ["zoom"], 0, 0, 10, 100]);
    });

    it("compiles interpolateHcl/interpolateLab to their hyphenated Mapbox names", () => {
      expect(
        compileSrc(`interpolateHcl linear camera.zoom
  0 then "red"
  10 then "blue"`),
      ).toEqual(["interpolate-hcl", ["linear"], ["zoom"], 0, "red", 10, "blue"]);
      expect(
        compileSrc(`interpolateLab linear camera.zoom
  0 then "red"
  10 then "blue"`),
      ).toEqual(["interpolate-lab", ["linear"], ["zoom"], 0, "red", 10, "blue"]);
    });

    it("accepts an arbitrary expression for the input and stop outputs", () => {
      expect(
        compileSrc(`interpolate linear get("population")
  0 then 1 + 1
  100 then abs(-5)`),
      ).toEqual([
        "interpolate",
        ["linear"],
        ["get", "population"],
        0,
        ["+", 1, 1],
        100,
        ["abs", ["-", 5]],
      ]);
    });

    it("is usable as the value of a variable assignment", () => {
      expect(
        compileSrc(`var x = interpolate linear camera.zoom
  0 then 1
  10 then 2
x + 1`),
      ).toEqual([
        "let",
        "x",
        ["interpolate", ["linear"], ["zoom"], 0, 1, 10, 2],
        ["+", ["var", "x"], 1],
      ]);
    });

    it("nests inside a function call argument", () => {
      expect(
        compileSrc(`min(20, max(4, interpolate linear camera.zoom
  0 then 4
  20 then 20))`),
      ).toEqual(["min", 20, ["max", 4, ["interpolate", ["linear"], ["zoom"], 0, 4, 20, 20]]]);
    });

    describe("errors", () => {
      it("rejects out-of-order stops", () => {
        expect(() =>
          compileSrc(`interpolate linear camera.zoom
  10 then 1
  5 then 2`),
        ).toThrow(RuntimeError);
        expect(() =>
          compileSrc(`interpolate linear camera.zoom
  10 then 1
  5 then 2`),
        ).toThrow("Stop inputs must be in strictly ascending order, but 5 does not come after 10");
      });

      it("rejects duplicate stop inputs", () => {
        expect(() =>
          compileSrc(`interpolate linear camera.zoom
  5 then 1
  5 then 2`),
        ).toThrow("Stop inputs must be in strictly ascending order, but 5 does not come after 5");
      });

      it("still checks ordering across three or more stops", () => {
        expect(() =>
          compileSrc(`interpolate linear camera.zoom
  0 then 1
  10 then 2
  5 then 3`),
        ).toThrow("Stop inputs must be in strictly ascending order, but 5 does not come after 10");
      });
    });
  });

  describe("step", () => {
    it("compiles a step expression", () => {
      expect(
        compileSrc(`step camera.zoom
  default 10
  12 then 20
  15 then 30`),
      ).toEqual(["step", ["zoom"], 10, 12, 20, 15, 30]);
    });

    it("accepts an arbitrary expression for the default value", () => {
      expect(compileSrc('step camera.zoom\n  default get("fallback")\n  12 then 20')).toEqual([
        "step",
        ["zoom"],
        ["get", "fallback"],
        12,
        20,
      ]);
    });

    it("is usable as the value of a variable assignment", () => {
      expect(
        compileSrc(`var x = step camera.zoom
  default 10
  12 then 20
x + 1`),
      ).toEqual(["let", "x", ["step", ["zoom"], 10, 12, 20], ["+", ["var", "x"], 1]]);
    });

    it("rejects out-of-order stops the same way interpolate does", () => {
      expect(() =>
        compileSrc(`step camera.zoom
  default 0
  10 then 1
  5 then 2`),
      ).toThrow("Stop inputs must be in strictly ascending order, but 5 does not come after 10");
    });
  });

  describe("interaction with 'let' flattening", () => {
    it("does not flatten a variable whose interpolate input depends on an earlier variable", () => {
      expect(
        compileSrc(`var a = camera.zoom
var b = interpolate linear a
  0 then 1
a`),
      ).toEqual([
        "let",
        "a",
        ["zoom"],
        ["let", "b", ["interpolate", ["linear"], ["var", "a"], 0, 1], ["var", "a"]],
      ]);
    });

    it("flattens a variable whose interpolate doesn't reference any earlier one", () => {
      expect(
        compileSrc(`var a = 5
var b = interpolate linear camera.zoom
  0 then 1
a + b`),
      ).toEqual([
        "let",
        "a",
        5,
        "b",
        ["interpolate", ["linear"], ["zoom"], 0, 1],
        ["+", ["var", "a"], ["var", "b"]],
      ]);
    });
  });
});
