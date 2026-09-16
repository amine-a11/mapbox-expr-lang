import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { Compiler, type MapboxExpression } from "../../src/compiler/compiler";

function compileSrc(source: string): MapboxExpression {
  const tokens = new Lexer(source).makeToken();
  const ast = new Parser(tokens, source).parse();
  return new Compiler(source).compile(ast);
}

describe("Compiler comparison operators", () => {
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
