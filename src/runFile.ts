import { readFileSync } from "node:fs";
import { Lexer } from "./lexer/lexer";
import { Parser } from "./parser/parser";
import { Compiler } from "./compiler/compiler";
import { LangError } from "./errors/langError";

const path = process.argv[2];
if (path === undefined) {
  console.error("Usage: npm run run-file -- <path/to/source-file>");
  process.exit(1);
}

const source = readFileSync(path, "utf8");

try {
  const tokens = new Lexer(source).makeToken();
  const ast = new Parser(tokens, source).parse();
  const result = new Compiler(source).compile(ast);
  console.dir(result, { depth: null });
} catch (error) {
  if (error instanceof LangError) {
    console.error(`${error}`);
    process.exit(1);
  }
  throw error;
}
