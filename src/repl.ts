import * as readline from "node:readline/promises";
import { Lexer } from "./lexer/lexer";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

while (true) {
  const input = await rl.question("mapbox-expr-lang> ");
  const lexer = new Lexer(input);
  const [tokens, error] = lexer.makeToken();
  if (error) console.log(`${error}`);
  else console.log(tokens);
}
