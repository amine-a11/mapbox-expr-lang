import { describe, expect, it } from "vitest";
import { Lexer } from "../../src/lexer/lexer";
import { Token, TokenType } from "../../src/lexer/token";

function tokenize(source: string): Token[] {
  return new Lexer(source).makeToken();
}

function simplify(tokens: Token[]): [TokenType, number | string | undefined][] {
  return tokens.map((t) => [t.type, t.value]);
}

const EOF = [TokenType.EOF, undefined] as const;

describe("Lexer newlines", () => {
  it("tokenizes a bare LF as NEWLINE", () => {
    expect(simplify(tokenize("1\n2"))).toEqual([
      [TokenType.INT, 1],
      [TokenType.NEWLINE, undefined],
      [TokenType.INT, 2],
      EOF,
    ]);
  });

  it("tokenizes a CRLF as exactly one NEWLINE, not two tokens", () => {
    expect(simplify(tokenize("1\r\n2"))).toEqual([
      [TokenType.INT, 1],
      [TokenType.NEWLINE, undefined],
      [TokenType.INT, 2],
      EOF,
    ]);
  });

  it("produces one NEWLINE token per line break, even for consecutive blank lines", () => {
    expect(simplify(tokenize("1\n\n\n2"))).toEqual([
      [TokenType.INT, 1],
      [TokenType.NEWLINE, undefined],
      [TokenType.NEWLINE, undefined],
      [TokenType.NEWLINE, undefined],
      [TokenType.INT, 2],
      EOF,
    ]);
  });

  it("tracks line and column across a newline", () => {
    const tokens = tokenize("1\n2");
    expect(tokens[2]?.posStart).toMatchObject({ idx: 2, ln: 1, col: 0 });
  });
});
