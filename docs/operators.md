---
title: Operator reference
permalink: /operators/
---

# Operator reference

Every operator this language supports, what it compiles to, and a link to
its page on [docs.mapbox.com](https://docs.mapbox.com/style-spec/reference/expressions/).
Anchors were checked against the live page, not guessed.

## Arithmetic

| Syntax        | Compiles to               | Docs                                                               |
| ------------- | ------------------------- | ------------------------------------------------------------------ |
| `a + b`       | `["+", a, b]`             | [`+`](https://docs.mapbox.com/style-spec/reference/expressions/#+) |
| `a - b`, `-a` | `["-", a, b]`, `["-", a]` | [`-`](https://docs.mapbox.com/style-spec/reference/expressions/#-) |
| `a * b`       | `["*", a, b]`             | [`*`](https://docs.mapbox.com/style-spec/reference/expressions/#*) |
| `a / b`       | `["/", a, b]`             | [`/`](https://docs.mapbox.com/style-spec/reference/expressions/#/) |
| `a % b`       | `["%", a, b]`             | [`%`](https://docs.mapbox.com/style-spec/reference/expressions/#%) |
| `a ^ b`       | `["^", a, b]`             | [`^`](https://docs.mapbox.com/style-spec/reference/expressions/#^) |

## Comparisons

| Syntax   | Compiles to    | Docs                                                                     |
| -------- | -------------- | ------------------------------------------------------------------------ |
| `a == b` | `["==", a, b]` | [`==`](https://docs.mapbox.com/style-spec/reference/expressions/#==)     |
| `a != b` | `["!=", a, b]` | [`!=`](https://docs.mapbox.com/style-spec/reference/expressions/#!=)     |
| `a < b`  | `["<", a, b]`  | [`<`](https://docs.mapbox.com/style-spec/reference/expressions/#%3C)     |
| `a <= b` | `["<=", a, b]` | [`<=`](https://docs.mapbox.com/style-spec/reference/expressions/#%3C%3D) |
| `a > b`  | `[">", a, b]`  | [`>`](https://docs.mapbox.com/style-spec/reference/expressions/#%3E)     |
| `a >= b` | `[">=", a, b]` | [`>=`](https://docs.mapbox.com/style-spec/reference/expressions/#%3E%3D) |

## Boolean logic

| Syntax    | Compiles to     | Docs                                                                   |
| --------- | --------------- | ---------------------------------------------------------------------- |
| `a and b` | `["all", a, b]` | [`all`](https://docs.mapbox.com/style-spec/reference/expressions/#all) |
| `a or b`  | `["any", a, b]` | [`any`](https://docs.mapbox.com/style-spec/reference/expressions/#any) |
| `not a`   | `["!", a]`      | [`!`](https://docs.mapbox.com/style-spec/reference/expressions/#!)     |

## Lookup

| Syntax                | Compiles to               | Docs                                                                   |
| --------------------- | ------------------------- | ---------------------------------------------------------------------- |
| `get("prop")`         | `["get", "prop"]`         | [`get`](https://docs.mapbox.com/style-spec/reference/expressions/#get) |
| `has("prop")`         | `["has", "prop"]`         | [`has`](https://docs.mapbox.com/style-spec/reference/expressions/#has) |
| `has("prop", object)` | `["has", "prop", object]` | [`has`](https://docs.mapbox.com/style-spec/reference/expressions/#has) |

## Variables

| Syntax          | Compiles to                 | Docs                                                                   |
| --------------- | --------------------------- | ---------------------------------------------------------------------- |
| `var x = value` | `["let", "x", value, body]` | [`let`](https://docs.mapbox.com/style-spec/reference/expressions/#let) |
| `x`             | `["var", "x"]`              | [`var`](https://docs.mapbox.com/style-spec/reference/expressions/#var) |

## Control flow

| Syntax                              | Compiles to               | Docs                                                                             |
| ----------------------------------- | ------------------------- | -------------------------------------------------------------------------------- |
| `if ... then ... elif ... else ...` | `["case", ...]`           | [`case`](https://docs.mapbox.com/style-spec/reference/expressions/#case)         |
| `match ... then ... else ...`       | `["match", ...]`          | [`match`](https://docs.mapbox.com/style-spec/reference/expressions/#match)       |
| `coalesce(a, b, ...)`               | `["coalesce", a, b, ...]` | [`coalesce`](https://docs.mapbox.com/style-spec/reference/expressions/#coalesce) |

## Ramps, scales, curves

| Syntax                            | Compiles to                | Docs                                                                                           |
| --------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| `interpolate <type> input ...`    | `["interpolate", ...]`     | [`interpolate`](https://docs.mapbox.com/style-spec/reference/expressions/#interpolate)         |
| `interpolateHcl <type> input ...` | `["interpolate-hcl", ...]` | [`interpolate-hcl`](https://docs.mapbox.com/style-spec/reference/expressions/#interpolate-hcl) |
| `interpolateLab <type> input ...` | `["interpolate-lab", ...]` | [`interpolate-lab`](https://docs.mapbox.com/style-spec/reference/expressions/#interpolate-lab) |
| `step input default ...`          | `["step", ...]`            | [`step`](https://docs.mapbox.com/style-spec/reference/expressions/#step)                       |

`<type>` is `linear`, `exponential(base)`, or `cubicBezier(x1, y1, x2, y2)`.

## Math functions

| Syntax                             | Docs                                                                                                                                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `abs(x)`                           | [`abs`](https://docs.mapbox.com/style-spec/reference/expressions/#abs)                                                                                                                                                       |
| `ceil(x)`                          | [`ceil`](https://docs.mapbox.com/style-spec/reference/expressions/#ceil)                                                                                                                                                     |
| `floor(x)`                         | [`floor`](https://docs.mapbox.com/style-spec/reference/expressions/#floor)                                                                                                                                                   |
| `round(x)`                         | [`round`](https://docs.mapbox.com/style-spec/reference/expressions/#round)                                                                                                                                                   |
| `sqrt(x)`                          | [`sqrt`](https://docs.mapbox.com/style-spec/reference/expressions/#sqrt)                                                                                                                                                     |
| `sin(x)`, `cos(x)`, `tan(x)`       | [`sin`](https://docs.mapbox.com/style-spec/reference/expressions/#sin), [`cos`](https://docs.mapbox.com/style-spec/reference/expressions/#cos), [`tan`](https://docs.mapbox.com/style-spec/reference/expressions/#tan)       |
| `asin(x)`, `acos(x)`, `atan(x)`    | [`asin`](https://docs.mapbox.com/style-spec/reference/expressions/#asin), [`acos`](https://docs.mapbox.com/style-spec/reference/expressions/#acos), [`atan`](https://docs.mapbox.com/style-spec/reference/expressions/#atan) |
| `ln(x)`, `log2(x)`, `log10(x)`     | [`ln`](https://docs.mapbox.com/style-spec/reference/expressions/#ln), [`log2`](https://docs.mapbox.com/style-spec/reference/expressions/#log2), [`log10`](https://docs.mapbox.com/style-spec/reference/expressions/#log10)   |
| `min(a, b, ...)`, `max(a, b, ...)` | [`min`](https://docs.mapbox.com/style-spec/reference/expressions/#min), [`max`](https://docs.mapbox.com/style-spec/reference/expressions/#max)                                                                               |

## String functions

| Syntax              | Docs                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| `concat(a, b, ...)` | [`concat`](https://docs.mapbox.com/style-spec/reference/expressions/#concat)     |
| `upcase(s)`         | [`upcase`](https://docs.mapbox.com/style-spec/reference/expressions/#upcase)     |
| `downcase(s)`       | [`downcase`](https://docs.mapbox.com/style-spec/reference/expressions/#downcase) |

## Color functions

| Syntax             | Docs                                                                     |
| ------------------ | ------------------------------------------------------------------------ |
| `rgb(r, g, b)`     | [`rgb`](https://docs.mapbox.com/style-spec/reference/expressions/#rgb)   |
| `rgba(r, g, b, a)` | [`rgba`](https://docs.mapbox.com/style-spec/reference/expressions/#rgba) |

## Type conversion

| Syntax             | Compiles to             | Docs                                                                                       |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------------ |
| `toNumber(x, ...)` | `["to-number", x, ...]` | [`to-number`](https://docs.mapbox.com/style-spec/reference/expressions/#types-to-number)   |
| `toString(x)`      | `["to-string", x]`      | [`to-string`](https://docs.mapbox.com/style-spec/reference/expressions/#types-to-string)   |
| `toBoolean(x)`     | `["to-boolean", x]`     | [`to-boolean`](https://docs.mapbox.com/style-spec/reference/expressions/#types-to-boolean) |
| `toColor(x, ...)`  | `["to-color", x, ...]`  | [`to-color`](https://docs.mapbox.com/style-spec/reference/expressions/#types-to-color)     |
| `typeof(x)`        | `["typeof", x]`         | [`typeof`](https://docs.mapbox.com/style-spec/reference/expressions/#types-typeof)         |

## Constants

Zero-argument operators, grouped by namespace.

| Syntax                 | Compiles to           | Docs                                                                                           |
| ---------------------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| `math.e`               | `["e"]`               | [`e`](https://docs.mapbox.com/style-spec/reference/expressions/#e)                             |
| `math.pi`              | `["pi"]`              | [`pi`](https://docs.mapbox.com/style-spec/reference/expressions/#pi)                           |
| `math.ln2`             | `["ln2"]`             | [`ln2`](https://docs.mapbox.com/style-spec/reference/expressions/#ln2)                         |
| `camera.zoom`          | `["zoom"]`            | [`zoom`](https://docs.mapbox.com/style-spec/reference/expressions/#zoom)                       |
| `feature.id`           | `["id"]`              | [`id`](https://docs.mapbox.com/style-spec/reference/expressions/#id)                           |
| `feature.geometryType` | `["geometry-type"]`   | [`geometry-type`](https://docs.mapbox.com/style-spec/reference/expressions/#geometry-type)     |
| `feature.lineProgress` | `["line-progress"]`   | [`line-progress`](https://docs.mapbox.com/style-spec/reference/expressions/#line-progress)     |
| `feature.properties`   | `["properties"]`      | [`properties`](https://docs.mapbox.com/style-spec/reference/expressions/#properties)           |
| `feature.accumulated`  | `["accumulated"]`     | [`accumulated`](https://docs.mapbox.com/style-spec/reference/expressions/#accumulated)         |
| `heatmap.density`      | `["heatmap-density"]` | [`heatmap-density`](https://docs.mapbox.com/style-spec/reference/expressions/#heatmap-density) |

## Not yet supported

Mostly the rest of the [Lookup](https://docs.mapbox.com/style-spec/reference/expressions/#lookup)
family beyond `get`/`has` (`at`, `at-interpolated`, `config`, `in`, `index-of`,
`length`, `measure-light`, `slice`, `split`, `worldview`), and the richer
[Types](https://docs.mapbox.com/style-spec/reference/expressions/#types)
(`array`, `object`, `collator`, `format`, `image`, `literal`, `number-format`).
[`distance`](https://docs.mapbox.com/style-spec/reference/expressions/#distance),
[`feature-state`](https://docs.mapbox.com/style-spec/reference/expressions/#feature-state),
and [`within`](https://docs.mapbox.com/style-spec/reference/expressions/#within)
(a Decision operator, not Lookup) take a GeoJSON geometry / a string argument /
a GeoJSON geometry respectively, and need their own syntax design rather than
fitting the patterns above.

Five documented Mapbox operators are left out on purpose, not by oversight:
[`random`](https://docs.mapbox.com/style-spec/reference/expressions/#random),
[`hsl`](https://docs.mapbox.com/style-spec/reference/expressions/#hsl),
[`hsla`](https://docs.mapbox.com/style-spec/reference/expressions/#hsla),
[`pitch`](https://docs.mapbox.com/style-spec/reference/expressions/#pitch), and
[`distance-from-center`](https://docs.mapbox.com/style-spec/reference/expressions/#distance-from-center)
aren't supported by this version. Revisit if that changes.
