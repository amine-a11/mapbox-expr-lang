import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { Compiler, type MapboxExpression } from "../../src/compiler/compiler";

function compileSrc(source: string): MapboxExpression {
  const tokens = new Lexer(source).makeToken();
  const ast = new Parser(tokens, source).parse();
  return new Compiler(source).compile(ast);
}

describe("Compiler get() / feature properties", () => {
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
