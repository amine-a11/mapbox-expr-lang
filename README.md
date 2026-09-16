<p align="center">
  <img src="docs/banner.jpg" alt="mapbox-expr-lang — write expressions naturally, compile them into Mapbox expressions" width="100%">
</p>

<h1 align="center">mapbox-expr-lang</h1>

<p align="center">
  A small language that compiles to <a href="https://docs.mapbox.com/style-spec/reference/expressions/">Mapbox GL JS</a> style expressions.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/mapbox-expr-lang"><img src="https://img.shields.io/npm/v/mapbox-expr-lang.svg" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/mapbox-expr-lang.svg" alt="license"></a>
</p>

<p align="center">
  <a href="https://amine-a11.github.io/mapbox-expr-lang/guide/">Guide</a> •
  <a href="https://amine-a11.github.io/mapbox-expr-lang/operators/">Operators</a> •
  <a href="grammar.md">Grammar</a> •
  <a href="#contributing">Contributing</a>
</p>

---

Write readable code, get back the JSON expression Mapbox expects.

```
var speed = get("speed")
var type = get("type")

if speed > 80 and type == "highway" then
  "red"
else
  "gray"
```

compiles to:

```json
[
  "let",
  "speed",
  ["get", "speed"],
  "type",
  ["get", "type"],
  ["case", ["all", [">", ["var", "speed"], 80], ["==", ["var", "type"], "highway"]], "red", "gray"]
]
```

## Install

```bash
npm install mapbox-expr-lang
```

## Usage

```ts
import { compile } from "mapbox-expr-lang";

compile('get("speed") > 80');
// [">", ["get", "speed"], 80]
```

That's the whole API: one function. It throws on invalid source, with a
message that says exactly what's wrong (`'and' requires a boolean operand,
but this is a number`, `Unknown function "typof"`, `Variable "x" is not
defined`, ...) — never an internal detail you can't act on.

## Docs

- **[Language guide](https://amine-a11.github.io/mapbox-expr-lang/guide/)** — a short tour of the language
- **[Operator reference](https://amine-a11.github.io/mapbox-expr-lang/operators/)** — every operator, linked to its page on [docs.mapbox.com](https://docs.mapbox.com/style-spec/reference/expressions/)
- **[Full grammar](grammar.md)** — the formal EBNF grammar

## Contributing

Contributions of any size are welcome — a typo fix, a missing operator, a
clearer error message.

```bash
git clone https://github.com/amine-a11/mapbox-expr-lang.git
cd mapbox-expr-lang
npm install
npm run test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide (project layout,
available scripts, and what a PR should look like before it's opened).

## License

[MIT](LICENSE)
