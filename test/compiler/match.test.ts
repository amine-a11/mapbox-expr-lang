import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { Compiler, type MapboxExpression } from "../../src/compiler/compiler";

function compileSrc(source: string): MapboxExpression {
  const tokens = new Lexer(source).makeToken();
  const ast = new Parser(tokens, source).parse();
  return new Compiler(source).compile(ast);
}

describe("Compiler match expressions", () => {
  it("compiles a single label to a 'match' with a fallback", () => {
    expect(compileSrc('match get("type") "road" then "red" else "blue"')).toEqual([
      "match",
      ["get", "type"],
      "road",
      "red",
      "blue",
    ]);
  });

  it("compiles multiple arms in order, ending with the fallback", () => {
    const source = `match get("type")
      "road" then "red"
      "water" then "blue"
      else "green"`;
    expect(compileSrc(source)).toEqual([
      "match",
      ["get", "type"],
      "road",
      "red",
      "water",
      "blue",
      "green",
    ]);
  });

  it("compiles a comma-separated label list to an array label, not separate arms", () => {
    const source = `match get("type")
      "water", "lake" then "blue"
      else "green"`;
    expect(compileSrc(source)).toEqual([
      "match",
      ["get", "type"],
      ["water", "lake"],
      "blue",
      "green",
    ]);
  });

  it("accepts number labels and a number input", () => {
    expect(compileSrc('match get("n") 1 then "one" 2 then "two" else "other"')).toEqual([
      "match",
      ["get", "n"],
      1,
      "one",
      2,
      "two",
      "other",
    ]);
  });

  it("compiles as the value of a variable assignment", () => {
    expect(
      compileSrc('var color = match get("type") "road" then "red" else "blue"\ncolor'),
    ).toEqual([
      "let",
      "color",
      ["match", ["get", "type"], "road", "red", "blue"],
      ["var", "color"],
    ]);
  });

  it("nests correctly when a branch is itself a match expression", () => {
    const source = 'match get("a") 1 then (match get("b") 2 then "x" else "y") else "z"';
    expect(compileSrc(source)).toEqual([
      "match",
      ["get", "a"],
      1,
      ["match", ["get", "b"], 2, "x", "y"],
      "z",
    ]);
  });

  describe("interaction with 'let' flattening", () => {
    it("does not flatten a variable whose match input depends on an earlier variable", () => {
      const source = 'var a = 5\nvar b = match a 1 then "one" else "other"\na';
      expect(compileSrc(source)).toEqual([
        "let",
        "a",
        5,
        ["let", "b", ["match", ["var", "a"], 1, "one", "other"], ["var", "a"]],
      ]);
    });

    it("does not flatten a variable whose match branch value depends on an earlier variable", () => {
      const source = "var a = 5\nvar b = match 1 1 then a else 0\na";
      expect(compileSrc(source)).toEqual([
        "let",
        "a",
        5,
        ["let", "b", ["match", 1, 1, ["var", "a"], 0], ["var", "a"]],
      ]);
    });

    it("flattens a variable whose match expression doesn't reference any earlier one", () => {
      const source = 'var a = 5\nvar b = match 1 1 then "one" else "other"\na';
      expect(compileSrc(source)).toEqual([
        "let",
        "a",
        5,
        "b",
        ["match", 1, 1, "one", "other"],
        ["var", "a"],
      ]);
    });
  });
});
