import * as readline from "node:readline/promises";
import { Lexer } from "./lexer/lexer";
import { Parser } from "./parser/parser";
import { LangError } from "./errors/langError";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

while (true) {
  const input = await rl.question("mapbox-expr-lang> ");

  try {
    const tokens = new Lexer(input).makeToken();
    const ast = new Parser(tokens, input).parse();
    console.log(ast);
  } catch (error) {
    if (error instanceof LangError) console.log(`${error}`);
    else throw error;
  }
}
