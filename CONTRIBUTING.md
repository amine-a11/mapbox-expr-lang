# Contributing to mapbox-expr-lang

## Setup

```bash
git clone https://github.com/amine-a11/mapbox-expr-lang.git
cd mapbox-expr-lang
npm install
```

Requires Node.js 18+.

## Running things locally

- `npm run dev` — a small REPL: type an expression, see the tokens and the compiled output.
- `npm run run-file -- path/to/source-file` — compile a source file and print the result.
- `npm run test` — run the test suite once.
- `npm run test:watch` — run tests in watch mode while you work.
- `npm run typecheck` — TypeScript, no emit.
- `npm run lint` / `npm run lint:fix` — ESLint.
- `npm run format` / `npm run format:check` — Prettier.
- `npm run build` — build the published `dist/` output.

## Project structure

```
src/
  lexer/      source text -> tokens
  parser/     tokens -> AST
  compiler/   AST -> Mapbox expression JSON
  errors/     the error hierarchy (every user-facing error)
  index.ts    the public API (just compile())
test/
  lexer/ parser/ compiler/   mirrors src/, one file per feature
  index.test.ts               the public API surface
  integration.test.ts         combined, realistic multi-feature programs
```

`grammar.md` has the formal grammar. `docs/` is the language guide and
operator reference published to GitHub Pages.

## Making a change

1. Fork the repo and create a branch off `main`.
2. Make your change. If it's a new operator or piece of syntax, add tests
   under `test/` following the existing style — a parser test for the AST
   shape, a compiler test for the compiled output.
3. If the change touches real Mapbox behavior you're not 100% sure about,
   check it against the [Mapbox expressions
   docs](https://docs.mapbox.com/style-spec/reference/expressions/) rather
   than guessing — arity, required arguments, and edge cases are easy to
   get subtly wrong.
4. Before opening a PR, make sure all of these pass:
   ```bash
   npm run typecheck
   npm run lint
   npm run format:check
   npm run test
   ```
5. Update `grammar.md` and/or `docs/` if the change adds or changes syntax.
6. Open a PR describing what changed and why.

## Reporting a bug or requesting a feature

Please use the issue templates when opening one — they ask for the source
that triggers a bug, or the syntax/behavior you'd like to see for a feature
request, which makes it much faster to act on.
