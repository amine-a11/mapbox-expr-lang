import { Lexer } from "./lexer/lexer";
import { Parser } from "./parser/parser";
import { Compiler, type MapboxExpression } from "./compiler/compiler";
import { LangError } from "./errors/langError";

const ISSUES_URL = "https://github.com/amine-a11/mapbox-expr-lang/issues";

function rethrowAsPublicError(error: unknown): never {
  if (error instanceof LangError) throw error;
  const detail = error instanceof Error ? error.message : String(error);
  throw new Error(
    `mapbox-expr-lang hit an internal error while compiling: ${detail}\n` +
      `This is a bug in the library, not your source -- please report it: ${ISSUES_URL}`,
  );
}

/**
 * Compiles mapbox-expr-lang source straight to a Mapbox/MapLibre GL style
 * expression. Throws on invalid source, with a message describing exactly
 * what's wrong and where.
 */
export function compile(source: string): MapboxExpression {
  try {
    const tokens = new Lexer(source).makeToken();
    const ast = new Parser(tokens, source).parse();
    return new Compiler(source).compile(ast);
  } catch (error) {
    rethrowAsPublicError(error);
  }
}
