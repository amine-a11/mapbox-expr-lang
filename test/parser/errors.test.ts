import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { IllegalCharError, InvalidSyntaxError } from "../../src/errors/langError";
import type { Node } from "../../src/parser/nodes";

function parse(source: string): Node {
  const tokens = new Lexer(source).makeToken();
  return new Parser(tokens, source).parse();
}

describe("Parser general errors", () => {
  it("throws on empty input", () => {
    expect(() => parse("")).toThrow(InvalidSyntaxError);
    expect(() => parse("")).toThrow("Unexpected end of input");
  });

  it("throws on an unmatched closing paren", () => {
    expect(() => parse(")")).toThrow("Unexpected token: RPAREN");
  });

  it("throws on empty parentheses", () => {
    expect(() => parse("()")).toThrow("Unexpected token: RPAREN");
  });

  it("throws when a closing paren is missing, and says what was found instead", () => {
    expect(() => parse("(1 + 2")).toThrow("Expected ')' (got end of input)");
  });

  it("throws on leftover input after an otherwise-complete expression", () => {
    expect(() => parse("1 + 2 3")).toThrow(InvalidSyntaxError);
    expect(() => parse("1 + 2 3")).toThrow("Unexpected token: INT:3");
  });

  it("propagates a lexer error without ever reaching the parser", () => {
    expect(() => parse("1 + @")).toThrow(IllegalCharError);
    expect(() => parse("1 + @")).toThrow("'@'");
  });

  it("points the error at the actual offending token", () => {
    try {
      parse("1 + 2 3");
      throw new Error("expected parse() to throw, but it didn't");
    } catch (error) {
      if (!(error instanceof InvalidSyntaxError)) throw error;
      expect(error.posStart).toMatchObject({ idx: 6, ln: 0, col: 6 });
    }
  });
});
