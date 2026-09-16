import {
  BinOpNode,
  BooleanNode,
  CallNode,
  ConstantNode,
  GetNode,
  IfNode,
  MatchNode,
  NumberNode,
  StringNode,
  UnaryOpNode,
  VarAccessNode,
  VarAssignNode,
  type MatchLabel,
  type Node,
} from "../parser/nodes";
import { TokenType, type Token } from "../lexer/token";
import { RuntimeError, TypeMismatchError } from "../errors/langError";

export type MapboxExpression = MapboxExpression[] | string | number | boolean | null;

const BINARY_OPERATORS: Partial<Record<TokenType, string>> = {
  [TokenType.PLUS]: "+",
  [TokenType.MINUS]: "-",
  [TokenType.MUL]: "*",
  [TokenType.DIV]: "/",
  [TokenType.MOD]: "%",
  [TokenType.POW]: "^",
  [TokenType.EE]: "==",
  [TokenType.NE]: "!=",
  [TokenType.LT]: "<",
  [TokenType.LTE]: "<=",
  [TokenType.GT]: ">",
  [TokenType.GTE]: ">=",
};

function operatorSymbol(token: Token): string | undefined {
  const symbol = BINARY_OPERATORS[token.type];
  if (symbol !== undefined) return symbol;
  if (token.type === TokenType.KEYWORD && token.value === "and") return "all";
  if (token.type === TokenType.KEYWORD && token.value === "or") return "any";
  return undefined;
}

const NUMERIC_OPERATORS = new Set(["+", "-", "*", "/", "%", "^"]);

// Every built-in function this language exposes. Names match Mapbox's own
// operator names except where Mapbox uses a hyphen (invalid in an
// identifier, and ambiguous with subtraction if it were allowed) -- those
// are camelCase instead: to-number -> toNumber, to-color -> toColor, etc.
//
// "random", "hsl", and "hsla" are deliberately left out: verified against
// the real evaluator (@maplibre/maplibre-gl-style-spec) that none of the
// three parse there at all ("Unknown expression"), even though they're
// documented Mapbox operators -- a genuine Mapbox/MapLibre divergence, not
// an oversight. Revisit if MapLibre ever adds support.
//
// minArgs/maxArgs are enforced here (maxArgs undefined = no upper limit)
// even where Mapbox itself is looser -- e.g. Mapbox's own "min"/"max"/
// "concat" accept zero arguments, but a zero-argument call is never
// meaningful in practice, so this language requires at least one.
//
// returnType is set only where the function's result can never be
// boolean, so nonBooleanType() below can catch e.g. "abs(x) and true" the
// same way it already catches "5 and true". Left unset (allowing anything,
// deferring to Mapbox) wherever the return type varies with the arguments
// (coalesce) or is genuinely boolean (toBoolean).
type NonBooleanType = "number" | "string" | "color" | "object";

interface FunctionSpec {
  mapboxName: string;
  minArgs: number;
  maxArgs: number | undefined;
  returnType?: NonBooleanType;
}

const FUNCTIONS: Record<string, FunctionSpec> = {
  // Math
  abs: { mapboxName: "abs", minArgs: 1, maxArgs: 1, returnType: "number" },
  ceil: { mapboxName: "ceil", minArgs: 1, maxArgs: 1, returnType: "number" },
  floor: { mapboxName: "floor", minArgs: 1, maxArgs: 1, returnType: "number" },
  round: { mapboxName: "round", minArgs: 1, maxArgs: 1, returnType: "number" },
  sqrt: { mapboxName: "sqrt", minArgs: 1, maxArgs: 1, returnType: "number" },
  sin: { mapboxName: "sin", minArgs: 1, maxArgs: 1, returnType: "number" },
  cos: { mapboxName: "cos", minArgs: 1, maxArgs: 1, returnType: "number" },
  tan: { mapboxName: "tan", minArgs: 1, maxArgs: 1, returnType: "number" },
  asin: { mapboxName: "asin", minArgs: 1, maxArgs: 1, returnType: "number" },
  acos: { mapboxName: "acos", minArgs: 1, maxArgs: 1, returnType: "number" },
  atan: { mapboxName: "atan", minArgs: 1, maxArgs: 1, returnType: "number" },
  ln: { mapboxName: "ln", minArgs: 1, maxArgs: 1, returnType: "number" },
  log2: { mapboxName: "log2", minArgs: 1, maxArgs: 1, returnType: "number" },
  log10: { mapboxName: "log10", minArgs: 1, maxArgs: 1, returnType: "number" },
  min: { mapboxName: "min", minArgs: 1, maxArgs: undefined, returnType: "number" },
  max: { mapboxName: "max", minArgs: 1, maxArgs: undefined, returnType: "number" },

  // String
  concat: { mapboxName: "concat", minArgs: 1, maxArgs: undefined, returnType: "string" },
  upcase: { mapboxName: "upcase", minArgs: 1, maxArgs: 1, returnType: "string" },
  downcase: { mapboxName: "downcase", minArgs: 1, maxArgs: 1, returnType: "string" },

  // Color
  rgb: { mapboxName: "rgb", minArgs: 3, maxArgs: 3, returnType: "color" },
  rgba: { mapboxName: "rgba", minArgs: 4, maxArgs: 4, returnType: "color" },

  // Type conversion
  toNumber: { mapboxName: "to-number", minArgs: 1, maxArgs: undefined, returnType: "number" },
  toString: {
    mapboxName: "to-string",
    minArgs: 1,
    maxArgs: 1,
    returnType: "string",
  } satisfies FunctionSpec,
  toBoolean: { mapboxName: "to-boolean", minArgs: 1, maxArgs: 1 },
  toColor: { mapboxName: "to-color", minArgs: 1, maxArgs: undefined, returnType: "color" },
  typeof: { mapboxName: "typeof", minArgs: 1, maxArgs: 1, returnType: "string" },

  // Decision
  coalesce: { mapboxName: "coalesce", minArgs: 1, maxArgs: undefined },
};

// Namespaced, zero-argument operators, e.g. "math.e" -> ["e"]. Grouped by
// Mapbox's own category headings for discoverability, following the request
// to move away from e()/pi()/ln2() as zero-arg calls -- these read more like
// constants/environment values than functions, so they get their own
// dotted-access grammar instead of overloading call syntax.
//
// Every member here was verified zero-arg and supported against the real
// evaluator (@maplibre/maplibre-gl-style-spec). Two documented Mapbox
// operators from the Camera category, "pitch" and "distance-from-center",
// were deliberately left out: verified "Unknown expression" against
// MapLibre, the same kind of Mapbox/MapLibre divergence already found for
// random/hsl/hsla. Revisit if MapLibre ever adds support. "feature-state" is
// excluded too, but for a different reason -- it takes a string argument
// like get(), so it isn't a zero-arg constant at all.
interface ConstantSpec {
  mapboxName: string;
  returnType?: NonBooleanType;
}

const CONSTANTS: Record<string, Record<string, ConstantSpec>> = {
  math: {
    e: { mapboxName: "e", returnType: "number" },
    pi: { mapboxName: "pi", returnType: "number" },
    ln2: { mapboxName: "ln2", returnType: "number" },
  },
  camera: {
    zoom: { mapboxName: "zoom", returnType: "number" },
  },
  feature: {
    id: { mapboxName: "id" }, // Mapbox's own signature: returns "value" (unknown)
    geometryType: { mapboxName: "geometry-type", returnType: "string" },
    lineProgress: { mapboxName: "line-progress", returnType: "number" },
    properties: { mapboxName: "properties", returnType: "object" },
    accumulated: { mapboxName: "accumulated" }, // "value" (unknown), only meaningful in clusterProperties
  },
  heatmap: {
    density: { mapboxName: "heatmap-density", returnType: "number" },
  },
};

function describeArgCount(spec: FunctionSpec): string {
  const plural = (n: number) => (n === 1 ? "argument" : "arguments");
  if (spec.minArgs === spec.maxArgs) return `exactly ${spec.minArgs} ${plural(spec.minArgs)}`;
  if (spec.maxArgs === undefined) return `at least ${spec.minArgs} ${plural(spec.minArgs)}`;
  return `${spec.minArgs}-${spec.maxArgs} arguments`;
}

// Returns the type a node is provably NOT a boolean as, or undefined when
// it might be boolean (or we can't tell -- get(), variables, if-results).
function nonBooleanType(node: Node): NonBooleanType | undefined {
  if (node instanceof NumberNode) return "number";
  if (node instanceof StringNode) return "string";
  if (node instanceof BinOpNode) {
    const op = operatorSymbol(node.opToken);
    return op !== undefined && NUMERIC_OPERATORS.has(op) ? "number" : undefined;
  }
  if (node instanceof UnaryOpNode) {
    if (node.opTok.type === TokenType.MINUS) return "number";
    if (node.opTok.type === TokenType.PLUS) return nonBooleanType(node.node);
  }
  if (node instanceof CallNode) {
    const name = typeof node.nameTok.value === "string" ? node.nameTok.value : undefined;
    return name !== undefined ? FUNCTIONS[name]?.returnType : undefined;
  }
  if (node instanceof ConstantNode) {
    const namespace =
      typeof node.namespaceTok.value === "string" ? node.namespaceTok.value : undefined;
    const member = typeof node.memberTok.value === "string" ? node.memberTok.value : undefined;
    if (namespace === undefined || member === undefined) return undefined;
    return CONSTANTS[namespace]?.[member]?.returnType;
  }
  return undefined;
}

// "object" is the only NonBooleanType that needs "an" instead of "a".
function withArticle(type: NonBooleanType): string {
  return type === "object" ? `an ${type}` : `a ${type}`;
}

const BOOLEAN_OPERATORS = new Set(["==", "!=", "<", "<=", ">", ">=", "all", "any"]);

// Returns true when a node is provably boolean-typed -- the opposite check
// from nonBooleanType, used for match's input, which Mapbox requires to be
// a number or string.
function isDefinitelyBoolean(node: Node): boolean {
  if (node instanceof BooleanNode) return true;
  if (node instanceof BinOpNode) {
    const op = operatorSymbol(node.opToken);
    return op !== undefined && BOOLEAN_OPERATORS.has(op);
  }
  if (node instanceof UnaryOpNode) {
    if (node.opTok.type === TokenType.KEYWORD && node.opTok.value === "not") return true;
    if (node.opTok.type === TokenType.PLUS) return isDefinitelyBoolean(node.node);
  }
  return false;
}

function referencesAnyOf(node: Node, names: ReadonlySet<string>): boolean {
  if (node instanceof VarAccessNode) {
    return typeof node.tok.value === "string" && names.has(node.tok.value);
  }
  if (node instanceof BinOpNode) {
    return referencesAnyOf(node.leftNode, names) || referencesAnyOf(node.rightNode, names);
  }
  if (node instanceof UnaryOpNode) {
    return referencesAnyOf(node.node, names);
  }
  if (node instanceof IfNode) {
    return (
      node.cases.some(
        (c) => referencesAnyOf(c.condition, names) || referencesAnyOf(c.value, names),
      ) || referencesAnyOf(node.elseCase, names)
    );
  }
  if (node instanceof MatchNode) {
    // Labels are always literal numbers/strings (never expressions), so
    // only the input and the branch values can reference a variable.
    return (
      referencesAnyOf(node.input, names) ||
      node.cases.some((c) => referencesAnyOf(c.value, names)) ||
      referencesAnyOf(node.elseCase, names)
    );
  }
  if (node instanceof CallNode) {
    return node.args.some((arg) => referencesAnyOf(arg, names));
  }
  return false;
}

class SymbolTable {
  private readonly declaredNames = new Set<string>();

  has(name: string): boolean {
    return this.declaredNames.has(name);
  }

  declare(name: string): void {
    this.declaredNames.add(name);
  }

  remove(name: string): void {
    this.declaredNames.delete(name);
  }
}

export class Compiler {
  private readonly symbolTable = new SymbolTable();

  constructor(public text: string) {}

  compile(node: Node): MapboxExpression {
    if (node instanceof NumberNode) return this.visitNumberNode(node);
    else if (node instanceof StringNode) return this.visitStringNode(node);
    else if (node instanceof BooleanNode) return this.visitBooleanNode(node);
    else if (node instanceof BinOpNode) return this.visitBinOpNode(node);
    else if (node instanceof UnaryOpNode) return this.visitUnaryOpNode(node);
    else if (node instanceof GetNode) return this.visitGetNode(node);
    else if (node instanceof VarAssignNode) return this.visitVarAssignNode(node);
    else if (node instanceof VarAccessNode) return this.visitVarAccessNode(node);
    else if (node instanceof IfNode) return this.visitIfNode(node);
    else if (node instanceof MatchNode) return this.visitMatchNode(node);
    else if (node instanceof CallNode) return this.visitCallNode(node);
    else if (node instanceof ConstantNode) return this.visitConstantNode(node);
    else throw new Error("No visit function for " + node);
  }

  private visitGetNode(node: GetNode): MapboxExpression {
    if (typeof node.tok.value !== "string") {
      throw new Error(`GetNode token has a non-string value: ${node.tok}`);
    }
    return ["get", node.tok.value];
  }

  private visitNumberNode(node: NumberNode): MapboxExpression {
    if (typeof node.tok.value !== "number") {
      throw new Error(`NumberNode token has a non-numeric value: ${node.tok}`);
    }
    return node.tok.value;
  }

  private visitStringNode(node: StringNode): MapboxExpression {
    if (typeof node.tok.value !== "string") {
      throw new Error(`StringNode token has a non-string value: ${node.tok}`);
    }
    return node.tok.value;
  }

  private visitBooleanNode(node: BooleanNode): MapboxExpression {
    if (node.tok.value !== "true" && node.tok.value !== "false") {
      throw new Error(`BooleanNode token has an unexpected value: ${node.tok}`);
    }
    return node.tok.value === "true";
  }

  private visitVarAssignNode(node: VarAssignNode): MapboxExpression {
    const batch: { name: string; valueNode: Node }[] = [];
    const namesInBatch = new Set<string>();
    let current: Node = node;

    while (current instanceof VarAssignNode) {
      const name = current.varNameTok.value;
      if (typeof name !== "string") {
        throw new Error(`VarAssignNode token has a non-string value: ${current.varNameTok}`);
      }

      if (namesInBatch.has(name) || referencesAnyOf(current.valueNode, namesInBatch)) {
        break;
      }

      batch.push({ name, valueNode: current.valueNode });
      namesInBatch.add(name);
      current = current.bodyNode;
    }

    const bindings: MapboxExpression[] = batch.flatMap(({ name, valueNode }) => [
      name,
      this.compile(valueNode),
    ]);

    for (const { name } of batch) this.symbolTable.declare(name);
    try {
      const body = this.compile(current);
      return ["let", ...bindings, body];
    } finally {
      for (const { name } of batch) this.symbolTable.remove(name);
    }
  }

  private visitVarAccessNode(node: VarAccessNode): MapboxExpression {
    const name = node.tok.value;
    if (typeof name !== "string") {
      throw new Error(`VarAccessNode token has a non-string value: ${node.tok}`);
    }

    if (!this.symbolTable.has(name)) {
      throw new RuntimeError(
        node.posStart,
        node.posEnd,
        `Variable "${name}" is not defined`,
        this.text,
      );
    }

    return ["var", name];
  }

  private visitIfNode(node: IfNode): MapboxExpression {
    const parts: MapboxExpression[] = [];
    for (const { condition, value } of node.cases) {
      const badType = nonBooleanType(condition);
      if (badType !== undefined) {
        throw new TypeMismatchError(
          condition.posStart,
          condition.posEnd,
          `'if'/'elif' condition must be a boolean, but this is ${withArticle(badType)}`,
          this.text,
        );
      }
      parts.push(this.compile(condition), this.compile(value));
    }
    parts.push(this.compile(node.elseCase));
    return ["case", ...parts];
  }

  private visitMatchNode(node: MatchNode): MapboxExpression {
    if (isDefinitelyBoolean(node.input)) {
      throw new TypeMismatchError(
        node.input.posStart,
        node.input.posEnd,
        "'match' input must be a number or a string, but this is a boolean",
        this.text,
      );
    }

    const parts: MapboxExpression[] = [this.compile(node.input)];
    for (const { labels, value } of node.cases) {
      parts.push(this.compileMatchLabels(labels), this.compile(value));
    }
    parts.push(this.compile(node.elseCase));
    return ["match", ...parts];
  }

  private compileMatchLabels(labels: MatchLabel[]): MapboxExpression {
    const compiled = labels.map((label) => this.compile(label));
    const [first, ...rest] = compiled;
    if (first === undefined) {
      throw new Error("MatchNode has an empty label list");
    }
    return rest.length === 0 ? first : [first, ...rest];
  }

  private visitCallNode(node: CallNode): MapboxExpression {
    const name = node.nameTok.value;
    if (typeof name !== "string") {
      throw new Error(`CallNode token has a non-string value: ${node.nameTok}`);
    }

    const spec = FUNCTIONS[name];
    if (spec === undefined) {
      throw new RuntimeError(
        node.nameTok.posStart,
        node.nameTok.posEnd,
        `Unknown function "${name}"`,
        this.text,
      );
    }

    const count = node.args.length;
    if (count < spec.minArgs || (spec.maxArgs !== undefined && count > spec.maxArgs)) {
      throw new RuntimeError(
        node.posStart,
        node.posEnd,
        `"${name}" expects ${describeArgCount(spec)}, but got ${count}`,
        this.text,
      );
    }

    return [spec.mapboxName, ...node.args.map((arg) => this.compile(arg))];
  }

  private visitConstantNode(node: ConstantNode): MapboxExpression {
    const namespace = node.namespaceTok.value;
    const member = node.memberTok.value;
    if (typeof namespace !== "string" || typeof member !== "string") {
      throw new Error(
        `ConstantNode has a non-string token: ${node.namespaceTok}.${node.memberTok}`,
      );
    }

    const spec = CONSTANTS[namespace]?.[member];
    if (spec === undefined) {
      throw new RuntimeError(
        node.posStart,
        node.posEnd,
        `Unknown constant "${namespace}.${member}"`,
        this.text,
      );
    }

    return [spec.mapboxName];
  }

  private visitBinOpNode(node: BinOpNode): MapboxExpression {
    const left = this.compile(node.leftNode);
    const right = this.compile(node.rightNode);

    const op = operatorSymbol(node.opToken);
    if (op === undefined) {
      throw new Error(`Compiler.visitBinOpNode: unsupported operator ${node.opToken}`);
    }

    if (op === "all" || op === "any") {
      const leftBadType = nonBooleanType(node.leftNode);
      if (leftBadType !== undefined) {
        throw new TypeMismatchError(
          node.leftNode.posStart,
          node.leftNode.posEnd,
          `'${node.opToken.value}' requires a boolean operand, but this is ${withArticle(leftBadType)}`,
          this.text,
        );
      }
      const rightBadType = nonBooleanType(node.rightNode);
      if (rightBadType !== undefined) {
        throw new TypeMismatchError(
          node.rightNode.posStart,
          node.rightNode.posEnd,
          `'${node.opToken.value}' requires a boolean operand, but this is ${withArticle(rightBadType)}`,
          this.text,
        );
      }
    }

    if (op === "+" || op === "*" || op === "all" || op === "any") {
      const leftArgs = Array.isArray(left) && left[0] === op ? left.slice(1) : [left];
      const rightArgs = Array.isArray(right) && right[0] === op ? right.slice(1) : [right];
      return [op, ...leftArgs, ...rightArgs];
    }

    return [op, left, right];
  }

  private visitUnaryOpNode(node: UnaryOpNode): MapboxExpression {
    const value = this.compile(node.node);

    if (node.opTok.type === TokenType.MINUS) {
      return ["-", value];
    }

    if (node.opTok.type === TokenType.KEYWORD && node.opTok.value === "not") {
      const badType = nonBooleanType(node.node);
      if (badType !== undefined) {
        throw new TypeMismatchError(
          node.node.posStart,
          node.node.posEnd,
          `'not' requires a boolean operand, but this is ${withArticle(badType)}`,
          this.text,
        );
      }
      return ["!", value];
    }

    return value;
  }
}
