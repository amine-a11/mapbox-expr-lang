import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import {
  CubicBezierInterpolationNode,
  ExponentialInterpolationNode,
  InterpolateNode,
  LinearInterpolationNode,
  StepNode,
  type Node,
} from "../../src/parser/nodes";

function parse(source: string): Node {
  const tokens = new Lexer(source).makeToken();
  return new Parser(tokens, source).parse();
}

function ast(source: string): string {
  return `${parse(source)}`;
}

describe("Parser interpolate/step", () => {
  describe("interpolate", () => {
    it("parses a linear interpolation with two stops", () => {
      expect(
        ast(`interpolate linear camera.zoom
  5 then 10
  10 then 40`),
      ).toBe("(INTERPOLATE LINEAR CONST:camera.zoom INT:5 -> INT:10, INT:10 -> INT:40)");
    });

    it("parses an exponential interpolation", () => {
      expect(
        ast(`interpolate exponential(2) camera.zoom
  0 then 0
  10 then 100`),
      ).toBe(
        "(INTERPOLATE EXPONENTIAL(INT:2) CONST:camera.zoom INT:0 -> INT:0, INT:10 -> INT:100)",
      );
    });

    it("parses a cubic-bezier interpolation", () => {
      expect(
        ast(`interpolate cubicBezier(0.42, 0, 1, 1) camera.zoom
  0 then 0
  10 then 100`),
      ).toBe(
        "(INTERPOLATE CUBIC_BEZIER(FLOAT:0.42, INT:0, INT:1, INT:1) CONST:camera.zoom INT:0 -> INT:0, INT:10 -> INT:100)",
      );
    });

    it("parses interpolateHcl and interpolateLab the same way, with a different label", () => {
      expect(
        ast(`interpolateHcl linear camera.zoom
  0 then "red"
  10 then "blue"`),
      ).toBe(
        "(INTERPOLATE_HCL LINEAR CONST:camera.zoom INT:0 -> STRING:red, INT:10 -> STRING:blue)",
      );
      expect(
        ast(`interpolateLab linear camera.zoom
  0 then "red"
  10 then "blue"`),
      ).toBe(
        "(INTERPOLATE_LAB LINEAR CONST:camera.zoom INT:0 -> STRING:red, INT:10 -> STRING:blue)",
      );
    });

    it("parses a single stop", () => {
      expect(ast("interpolate linear camera.zoom\n  5 then 10")).toBe(
        "(INTERPOLATE LINEAR CONST:camera.zoom INT:5 -> INT:10)",
      );
    });

    it("is usable as a var value, correctly resuming the statement sequence afterwards", () => {
      const node = parse(`var x = interpolate linear camera.zoom
  0 then 1
  10 then 2
x + 1`);
      expect(`${node}`).toBe(
        "(VAR:x, (INTERPOLATE LINEAR CONST:camera.zoom INT:0 -> INT:1, INT:10 -> INT:2), (IDENTIFIER:x, PLUS, INT:1))",
      );
    });

    it("nests inside a function call argument", () => {
      expect(
        ast(`min(20, interpolate linear camera.zoom
  0 then 4
  20 then 20)`),
      ).toBe(
        "CALL:min(INT:20, (INTERPOLATE LINEAR CONST:camera.zoom INT:0 -> INT:4, INT:20 -> INT:20))",
      );
    });

    describe("node structure", () => {
      it("builds an InterpolateNode with the variant, type, input, and stops in the right place", () => {
        const node = parse(`interpolate linear camera.zoom
  5 then 10
  10 then 40`);
        expect(node).toBeInstanceOf(InterpolateNode);
        if (node instanceof InterpolateNode) {
          expect(node.variant).toBe("interpolate");
          expect(node.interpolationType).toBeInstanceOf(LinearInterpolationNode);
          expect(node.stops).toHaveLength(2);
          expect(node.stops[0]?.input.tok.value).toBe(5);
        }
      });

      it("builds an ExponentialInterpolationNode with the base", () => {
        const node = parse("interpolate exponential(2.5) camera.zoom\n  0 then 0");
        expect(node).toBeInstanceOf(InterpolateNode);
        if (node instanceof InterpolateNode) {
          expect(node.interpolationType).toBeInstanceOf(ExponentialInterpolationNode);
          if (node.interpolationType instanceof ExponentialInterpolationNode) {
            expect(`${node.interpolationType.base}`).toBe("FLOAT:2.5");
          }
        }
      });

      it("builds a CubicBezierInterpolationNode with the four control points", () => {
        const node = parse("interpolate cubicBezier(0.1, 0.2, 0.3, 0.4) camera.zoom\n  0 then 0");
        expect(node).toBeInstanceOf(InterpolateNode);
        if (node instanceof InterpolateNode) {
          expect(node.interpolationType).toBeInstanceOf(CubicBezierInterpolationNode);
        }
      });
    });

    describe("errors", () => {
      it("throws when the interpolation type is missing", () => {
        expect(() => parse("interpolate camera.zoom\n  5 then 10")).toThrow(
          "expected 'linear', 'exponential(base)', or 'cubicBezier(x1, y1, x2, y2)'",
        );
      });

      it("throws when the interpolation type name is unrecognized", () => {
        expect(() => parse("interpolate quadratic camera.zoom\n  5 then 10")).toThrow(
          "expected 'linear', 'exponential(base)', or 'cubicBezier(x1, y1, x2, y2)'",
        );
      });

      it("throws when no stops are given", () => {
        expect(() => parse("interpolate linear camera.zoom")).toThrow(
          "Unexpected end of input, expected a number",
        );
      });

      it("throws when 'then' is missing", () => {
        expect(() => parse("interpolate linear camera.zoom\n  5 10")).toThrow("Expected 'then'");
      });

      it("throws when a stop input is not a number literal", () => {
        expect(() => parse('interpolate linear camera.zoom\n  "x" then 10')).toThrow(
          "expected a number",
        );
      });
    });
  });

  describe("step", () => {
    it("parses a step expression with a default and stops", () => {
      expect(
        ast(`step camera.zoom
  default 10
  12 then 20
  15 then 30`),
      ).toBe("(STEP CONST:camera.zoom DEFAULT INT:10 INT:12 -> INT:20, INT:15 -> INT:30)");
    });

    it("parses a single stop", () => {
      expect(ast("step camera.zoom\n  default 10\n  12 then 20")).toBe(
        "(STEP CONST:camera.zoom DEFAULT INT:10 INT:12 -> INT:20)",
      );
    });

    it("is usable as a var value, correctly resuming the statement sequence afterwards", () => {
      const node = parse(`var x = step camera.zoom
  default 10
  12 then 20
x + 1`);
      expect(`${node}`).toBe(
        "(VAR:x, (STEP CONST:camera.zoom DEFAULT INT:10 INT:12 -> INT:20), (IDENTIFIER:x, PLUS, INT:1))",
      );
    });

    describe("node structure", () => {
      it("builds a StepNode with the input, default, and stops in the right place", () => {
        const node = parse("step camera.zoom\n  default 10\n  12 then 20\n  15 then 30");
        expect(node).toBeInstanceOf(StepNode);
        if (node instanceof StepNode) {
          expect(`${node.defaultValue}`).toBe("INT:10");
          expect(node.stops).toHaveLength(2);
          expect(node.stops[1]?.input.tok.value).toBe(15);
        }
      });
    });

    describe("errors", () => {
      it("throws when 'default' is missing", () => {
        expect(() => parse("step camera.zoom\n  12 then 20")).toThrow("Expected 'default'");
      });

      it("throws when no stops follow the default", () => {
        expect(() => parse("step camera.zoom\n  default 10")).toThrow(
          "Unexpected end of input, expected a number",
        );
      });
    });
  });
});
