import { describe, expect, it, vi } from "vitest";
import { compile } from "../src/index";
import { Compiler } from "../src/compiler/compiler";

// The public API published to npm is exactly one function. Everything else
// in src/ (Lexer, Parser, Compiler, the LangError hierarchy) is an
// implementation detail, reached only through compile()'s behavior here.
describe("Public API", () => {
  it("compile() compiles source straight to a Mapbox expression", () => {
    expect(compile('get("speed") > 80')).toEqual([">", ["get", "speed"], 80]);
  });

  it("compile() throws a readable, positioned message on invalid source", () => {
    expect(() => compile("1 and true")).toThrow(
      "'and' requires a boolean operand, but this is a number",
    );
  });

  it("compile() throws a readable message for a parse error, not a raw token dump", () => {
    expect(() => compile("var x =")).toThrow(/Unexpected end of input, expected/);
  });

  it("compile() throws a readable message for an unknown variable/function", () => {
    expect(() => compile("unknownThing")).toThrow('Variable "unknownThing" is not defined');
    expect(() => compile("banana(1, 2)")).toThrow('Unknown function "banana"');
  });

  it("wraps an unexpected internal error in a clear, actionable message instead of leaking it raw", () => {
    const spy = vi.spyOn(Compiler.prototype, "compile").mockImplementation(() => {
      throw new Error("No visit function for [object Object]");
    });
    try {
      expect(() => compile("1 + 1")).toThrow(/internal error/i);
      expect(() => compile("1 + 1")).toThrow(/please report it/i);
      expect(() => compile("1 + 1")).toThrow(/github\.com\/amine-a11\/mapbox-expr-lang\/issues/);
    } finally {
      spy.mockRestore();
    }
  });
});
