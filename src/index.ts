import * as readline from "readline/promises";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
while (true) {
  const input = await rl.question("mapbox-expr-lang>");
  console.log(input);
}
