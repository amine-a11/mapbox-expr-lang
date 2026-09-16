import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { Compiler, type MapboxExpression } from "../../src/compiler/compiler";

function compileSrc(source: string): MapboxExpression {
  const tokens = new Lexer(source).makeToken();
  const ast = new Parser(tokens, source).parse();
  return new Compiler(source).compile(ast);
}

describe("Compiler boolean logic (and/or/not)", () => {
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
