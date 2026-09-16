import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { Compiler, type MapboxExpression } from "../../src/compiler/compiler";

function compileSrc(source: string): MapboxExpression {
  const tokens = new Lexer(source).makeToken();
  const ast = new Parser(tokens, source).parse();
  return new Compiler(source).compile(ast);
}

describe("Compiler if expressions", () => {
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

  describe("interaction with 'let' flattening", () => {
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
