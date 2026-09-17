---
title: Language guide
permalink: /guide/
---

# Language guide

Learn the language by example. Every snippet below shows the source and the
exact JSON `compile()` returns for it.

For the full list of operators, see the [operator reference](operators.md).
For the formal grammar, see [grammar.md](https://github.com/amine-a11/mapbox-expr-lang/blob/main/grammar.md).
Want to try snippets as you read? Use the [playground](playground.html).

## Values

Numbers, strings, and booleans compile straight to their JSON equivalent.

```
42
```

```json
42
```

```
3.14
```

```json
3.14
```

```
"hello world"
```

```json
"hello world"
```

```
true
```

```json
true
```

`true`/`false` are real booleans, not `1`/`0`.

## Reading feature properties

[`get(...)`](https://docs.mapbox.com/style-spec/reference/expressions/#get) reads a property from the current feature.

```
get("name")
```

```json
["get", "name"]
```

## Arithmetic

`+ - * / % ^`, with the precedence you'd expect, plus unary `-`.

```
1 + 2
```

```json
["+", 1, 2]
```

```
2 + 3 * 4
```

```json
["+", 2, ["*", 3, 4]]
```

```
(2 + 3) * 4
```

```json
["*", ["+", 2, 3], 4]
```

```
-5 + 10
```

```json
["+", ["-", 5], 10]
```

```
2 ^ 10
```

```json
["^", 2, 10]
```

## Comparisons

`== != < <= > >=`

```
get("speed") > 80
```

```json
[">", ["get", "speed"], 80]
```

```
get("type") == "highway"
```

```json
["==", ["get", "type"], "highway"]
```

## Boolean logic

`and` / `or` / `not`.

```
get("speed") > 50 and get("speed") < 100
```

```json
["all", [">", ["get", "speed"], 50], ["<", ["get", "speed"], 100]]
```

```
(get("speed") > 80 or get("lane_count") > 2) and get("type") == "highway"
```

```json
[
  "all",
  ["any", [">", ["get", "speed"], 80], [">", ["get", "lane_count"], 2]],
  ["==", ["get", "type"], "highway"]
]
```

`and`/`or`/`not` reject a value that's provably not a boolean, e.g. `1 and true` fails to compile with a clear error -- see [Errors](#errors) below.

## Variables

`var name = expr`. Every later line can use it.

```
var x = 10
x * 2
```

```json
["let", "x", 10, ["*", ["var", "x"], 2]]
```

```
var speed = get("speed")
var isFast = speed > 80
isFast
```

```json
[
  "let",
  "speed",
  ["get", "speed"],
  ["let", "isFast", [">", ["var", "speed"], 80], ["var", "isFast"]]
]
```

## if / elif / else

`else` is required, same as Mapbox's own `case`.

```
if get("speed") > 80 then "fast" else "slow"
```

```json
["case", [">", ["get", "speed"], 80], "fast", "slow"]
```

```
if get("speed") > 100 then
  "very fast"
elif get("speed") > 50 then
  "fast"
else
  "slow"
```

```json
["case", [">", ["get", "speed"], 100], "very fast", [">", ["get", "speed"], 50], "fast", "slow"]
```

## match

Compare one value against several possibilities. A comma-separated list of
labels shares one output.

```
match get("type")
  "water" then "blue"
  else "gray"
```

```json
["match", ["get", "type"], "water", "blue", "gray"]
```

```
match get("type")
  "motorway", "trunk", "primary" then "red"
  "secondary", "tertiary" then "orange"
  else "gray"
```

```json
[
  "match",
  ["get", "type"],
  ["motorway", "trunk", "primary"],
  "red",
  ["secondary", "tertiary"],
  "orange",
  "gray"
]
```

Labels can be numbers too:

```
match get("lanes")
  1 then "thin"
  2, 3 then "medium"
  else "thick"
```

```json
["match", ["get", "lanes"], 1, "thin", [2, 3], "medium", "thick"]
```

## Functions

Called like you'd expect in any language: `name(arg1, arg2, ...)`. See the
[operator reference](operators.md) for the full list, grouped by category
(math, string, color, type conversion).

```
abs(-42)
sqrt(16)
min(10, max(2, get("size")))
```

```json
["abs", ["-", 42]]
["sqrt", 16]
["min", 10, ["max", 2, ["get", "size"]]]
```

```
concat(get("name"), " - ", get("type"))
upcase(get("name"))
```

```json
["concat", ["get", "name"], " - ", ["get", "type"]]
["upcase", ["get", "name"]]
```

```
rgb(255, 0, 0)
rgba(0, 128, 255, 0.5)
```

```json
["rgb", 255, 0, 0]
["rgba", 0, 128, 255, 0.5]
```

```
toNumber(get("population"))
toBoolean(get("visible"))
```

```json
["to-number", ["get", "population"]]
["to-boolean", ["get", "visible"]]
```

`coalesce` returns the first non-null argument -- handy for a property that
might be missing from some features:

```
coalesce(get("name_en"), get("name"), "Unnamed")
```

```json
["coalesce", ["get", "name_en"], ["get", "name"], "Unnamed"]
```

## Constants

Zero-argument operators, grouped under a short namespace so they're easy to
find (`math.*`, `camera.*`, `feature.*`, `heatmap.*`). See the
[operator reference](operators.md#constants) for the full list.

```
math.pi
math.e
camera.zoom
feature.id
```

```json
["pi"]
["e"]
["zoom"]
["id"]
```

## interpolate / step

Smoothly (`interpolate`) or discretely (`step`) map an input to an output
across a series of stops. Stop inputs must be number literals in strictly
ascending order.

```
interpolate linear camera.zoom
  5  then 2
  15 then 20
```

```json
["interpolate", ["linear"], ["zoom"], 5, 2, 15, 20]
```

The interpolation type can also be `exponential(base)`:

```
interpolate exponential(1.5) camera.zoom
  5  then 2
  15 then 20
```

```json
["interpolate", ["exponential", 1.5], ["zoom"], 5, 2, 15, 20]
```

A third option is `cubicBezier(x1, y1, x2, y2)` -- the same easing-curve
shape as CSS's `cubic-bezier()` -- for eases that aren't a straight line or
a simple exponential curve:

```
interpolate cubicBezier(0.42, 0, 0.58, 1) camera.zoom
  0 then 0
  1 then 1
```

```json
["interpolate", ["cubic-bezier", 0.42, 0, 0.58, 1], ["zoom"], 0, 0, 1, 1]
```

`interpolateHcl`/`interpolateLab` work the same way, for interpolating
colors in a different color space:

```
interpolateLab linear camera.zoom
  0  then "yellow"
  10 then "red"
```

```json
["interpolate-lab", ["linear"], ["zoom"], 0, "yellow", 10, "red"]
```

`step` picks the output for the stop just below the input, with a
`default` for anything below the first one:

```
step get("magnitude")
  default "small"
  3 then "medium"
  6 then "large"
```

```json
["step", ["get", "magnitude"], "small", 3, "medium", 6, "large"]
```

## Putting it together

A more realistic example, combining variables, boolean logic, `if`/`elif`,
and `interpolate`:

```
var speed = get("speed")
var type = get("type")
var isHighway = type == "motorway" or type == "trunk"

if isHighway and speed > 100 then
  rgb(255, 0, 0)
elif isHighway then
  rgb(255, 165, 0)
else
  interpolate linear speed
    0   then rgb(200, 200, 200)
    120 then rgb(0, 200, 0)
```

```json
[
  "let",
  "speed",
  ["get", "speed"],
  "type",
  ["get", "type"],
  [
    "let",
    "isHighway",
    ["any", ["==", ["var", "type"], "motorway"], ["==", ["var", "type"], "trunk"]],
    [
      "case",
      ["all", ["var", "isHighway"], [">", ["var", "speed"], 100]],
      ["rgb", 255, 0, 0],
      ["var", "isHighway"],
      ["rgb", 255, 165, 0],
      [
        "interpolate",
        ["linear"],
        ["var", "speed"],
        0,
        ["rgb", 200, 200, 200],
        120,
        ["rgb", 0, 200, 0]
      ]
    ]
  ]
]
```

A second one: deriving a metric that doesn't exist as its own property --
here, population density from two raw fields -- before ramping it through a
color scale.

```
var density = get("population") / get("area_km2")

interpolate linear density
  0    then rgb(255, 255, 255)
  1000 then rgb(200, 0, 0)
```

```json
[
  "let",
  "density",
  ["/", ["get", "population"], ["get", "area_km2"]],
  [
    "interpolate",
    ["linear"],
    ["var", "density"],
    0,
    ["rgb", 255, 255, 255],
    1000,
    ["rgb", 200, 0, 0]
  ]
]
```

## Using with TypeScript

`compile()` returns a general JSON-value type, not one tied to the specific
Mapbox/MapLibre paint or layout property you're assigning it to -- there's
no way to know that ahead of time from a string of source. Libraries like
`@types/mapbox-gl` type each property narrowly (e.g.
`DataDrivenPropertyValueSpecification<number>` for `circle-radius`), so
assigning a compiled expression directly will fail to typecheck. One cast
at the call site is the fix, same as you'd need for a hand-written
expression array:

```ts
import { compile } from "mapbox-expr-lang";
import type { DataDrivenPropertyValueSpecification } from "mapbox-gl";

map.setPaintProperty(
  "quakes",
  "circle-radius",
  compile(`
    interpolate linear get("mag")
      1 then 3
      8 then 38
  `) as unknown as DataDrivenPropertyValueSpecification<number>,
);
```

## Errors

`compile()` throws with a message that says exactly what's wrong:

```
1 and true
```

```
'and' requires a boolean operand, but this is a number
```

```
typof(5)
```

```
Unknown function "typof"
```

```
unknownVar + 1
```

```
Variable "unknownVar" is not defined
```

```
min()
```

```
"min" expects at least 1 argument, but got 0
```

Interpolate/step stops are checked for ascending order at compile time,
the same rule Mapbox enforces at evaluation time -- just caught earlier,
with a precise position:

```
interpolate linear camera.zoom
  10 then 1
  5  then 2
```

```
Stop inputs must be in strictly ascending order, but 5 does not come after 10
```

```ts
import { compile } from "mapbox-expr-lang";

try {
  compile("1 and true");
} catch (error) {
  console.error(error.message);
  // 'and' requires a boolean operand, but this is a number
}
```
