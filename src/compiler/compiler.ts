import {
  BinOpNode,
  BooleanNode,
  CallNode,
  ConstantNode,
  CubicBezierInterpolationNode,
  ExponentialInterpolationNode,
  GetNode,
  IfNode,
  InterpolateNode,
  LinearInterpolationNode,
  MatchNode,
  NumberNode,
  StepNode,
  StringNode,
  UnaryOpNode,
  VarAccessNode,
  VarAssignNode,
  type InterpolateStop,
  type InterpolationType,
  type MatchLabel,
  type Node,
  type StepStop,
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

type DefiniteType = "number" | "string" | "boolean" | "color" | "object";
type NonBooleanType = Exclude<DefiniteType, "boolean">;

interface FunctionSpec {
  mapboxName: string;
  minArgs: number;
  maxArgs: number | undefined;
  returnType?: DefiniteType;
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
  toBoolean: { mapboxName: "to-boolean", minArgs: 1, maxArgs: 1, returnType: "boolean" },
  toColor: { mapboxName: "to-color", minArgs: 1, maxArgs: undefined, returnType: "color" },
  typeof: { mapboxName: "typeof", minArgs: 1, maxArgs: 1, returnType: "string" },

  // Decision
  coalesce: { mapboxName: "coalesce", minArgs: 1, maxArgs: undefined },
};

interface ConstantSpec {
  mapboxName: string;
  returnType?: DefiniteType;
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

const BOOLEAN_OPERATORS = new Set(["==", "!=", "<", "<=", ">", ">=", "all", "any"]);

function inferType(node: Node): DefiniteType | undefined {
  if (node instanceof NumberNode) return "number";
  if (node instanceof StringNode) return "string";
  if (node instanceof BooleanNode) return "boolean";
  if (node instanceof BinOpNode) {
    const op = operatorSymbol(node.opToken);
    if (op === undefined) return undefined;
    if (NUMERIC_OPERATORS.has(op)) return "number";
    if (BOOLEAN_OPERATORS.has(op)) return "boolean";
    return undefined;
  }
  if (node instanceof UnaryOpNode) {
    if (node.opTok.type === TokenType.MINUS) return "number";
    if (node.opTok.type === TokenType.KEYWORD && node.opTok.value === "not") return "boolean";
    if (node.opTok.type === TokenType.PLUS) return inferType(node.node);
    return undefined;
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

function nonBooleanType(node: Node): NonBooleanType | undefined {
  const type = inferType(node);
  return type !== undefined && type !== "boolean" ? type : undefined;
}

function nonNumericType(node: Node): Exclude<DefiniteType, "number"> | undefined {
  const type = inferType(node);
  return type !== undefined && type !== "number" ? type : undefined;
}

function withArticle(type: DefiniteType): string {
  return type === "object" ? `an ${type}` : `a ${type}`;
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
    return (
      referencesAnyOf(node.input, names) ||
      node.cases.some((c) => referencesAnyOf(c.value, names)) ||
      referencesAnyOf(node.elseCase, names)
    );
  }
  if (node instanceof CallNode) {
    return node.args.some((arg) => referencesAnyOf(arg, names));
  }
  if (node instanceof InterpolateNode) {
    return (
      referencesAnyOf(node.input, names) ||
      interpolationTypeOperands(node.interpolationType).some((n) => referencesAnyOf(n, names)) ||
      node.stops.some((s) => referencesAnyOf(s.value, names))
    );
  }
  if (node instanceof StepNode) {
    return (
      referencesAnyOf(node.input, names) ||
      referencesAnyOf(node.defaultValue, names) ||
      node.stops.some((s) => referencesAnyOf(s.value, names))
    );
  }
  return false;
}

function interpolationTypeOperands(type: InterpolationType): Node[] {
  if (type instanceof LinearInterpolationNode) return [];
  if (type instanceof ExponentialInterpolationNode) return [type.base];
  return [type.x1, type.y1, type.x2, type.y2];
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
    else if (node instanceof InterpolateNode) return this.visitInterpolateNode(node);
    else if (node instanceof StepNode) return this.visitStepNode(node);
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
    const inputType = inferType(node.input);
    if (inputType !== undefined && inputType !== "number" && inputType !== "string") {
      throw new TypeMismatchError(
        node.input.posStart,
        node.input.posEnd,
        `'match' input must be a number or a string, but this is ${withArticle(inputType)}`,
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

  private visitInterpolateNode(node: InterpolateNode): MapboxExpression {
    this.validateAscendingStops(node.stops);

    const mapboxName =
      node.variant === "interpolate"
        ? "interpolate"
        : node.variant === "interpolateHcl"
          ? "interpolate-hcl"
          : "interpolate-lab";

    const parts: MapboxExpression[] = [
      mapboxName,
      this.compileInterpolationType(node.interpolationType),
      this.compile(node.input),
    ];
    for (const { input, value } of node.stops) {
      parts.push(this.compile(input), this.compile(value));
    }
    return parts;
  }

  private compileInterpolationType(type: InterpolationType): MapboxExpression {
    if (type instanceof LinearInterpolationNode) return ["linear"];
    if (type instanceof ExponentialInterpolationNode) {
      return ["exponential", this.compile(type.base)];
    }
    if (type instanceof CubicBezierInterpolationNode) {
      return [
        "cubic-bezier",
        this.compile(type.x1),
        this.compile(type.y1),
        this.compile(type.x2),
        this.compile(type.y2),
      ];
    }
    throw new Error(`Compiler.compileInterpolationType: unsupported interpolation type ${type}`);
  }

  private visitStepNode(node: StepNode): MapboxExpression {
    this.validateAscendingStops(node.stops);

    const parts: MapboxExpression[] = [
      "step",
      this.compile(node.input),
      this.compile(node.defaultValue),
    ];
    for (const { input, value } of node.stops) {
      parts.push(this.compile(input), this.compile(value));
    }
    return parts;
  }

  private validateAscendingStops(stops: (InterpolateStop | StepStop)[]): void {
    for (let i = 1; i < stops.length; i++) {
      const previous = stops[i - 1];
      const current = stops[i];
      if (previous === undefined || current === undefined) continue;

      const previousValue = previous.input.tok.value;
      const currentValue = current.input.tok.value;
      if (
        typeof previousValue === "number" &&
        typeof currentValue === "number" &&
        currentValue <= previousValue
      ) {
        throw new RuntimeError(
          current.input.posStart,
          current.input.posEnd,
          `Stop inputs must be in strictly ascending order, but ${currentValue} does not come after ${previousValue}`,
          this.text,
        );
      }
    }
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

    if (NUMERIC_OPERATORS.has(op)) {
      const leftBadType = nonNumericType(node.leftNode);
      if (leftBadType !== undefined) {
        throw new TypeMismatchError(
          node.leftNode.posStart,
          node.leftNode.posEnd,
          `'${op}' requires a numeric operand, but this is ${withArticle(leftBadType)}`,
          this.text,
        );
      }
      const rightBadType = nonNumericType(node.rightNode);
      if (rightBadType !== undefined) {
        throw new TypeMismatchError(
          node.rightNode.posStart,
          node.rightNode.posEnd,
          `'${op}' requires a numeric operand, but this is ${withArticle(rightBadType)}`,
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
      const badType = nonNumericType(node.node);
      if (badType !== undefined) {
        throw new TypeMismatchError(
          node.node.posStart,
          node.node.posEnd,
          `'-' requires a numeric operand, but this is ${withArticle(badType)}`,
          this.text,
        );
      }
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
