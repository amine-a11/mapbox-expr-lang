import type { Token } from "../lexer/token";
import type { Position } from "../errors/position";

const NODE_INSPECT_CUSTOM = Symbol.for("nodejs.util.inspect.custom");

export type Node =
  | NumberNode
  | StringNode
  | BinOpNode
  | UnaryOpNode
  | GetNode
  | BooleanNode
  | VarAccessNode
  | VarAssignNode
  | IfNode
  | MatchNode
  | CallNode
  | ConstantNode
  | InterpolateNode
  | StepNode;

export interface Positioned {
  posStart: Position;
  posEnd: Position;
}

export class NumberNode implements Positioned {
  posStart: Position;
  posEnd: Position;

  constructor(public tok: Token) {
    this.posStart = tok.posStart;
    this.posEnd = tok.posEnd;
  }

  toString(): string {
    return `${this.tok}`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

export class StringNode implements Positioned {
  posStart: Position;
  posEnd: Position;

  constructor(public tok: Token) {
    this.posStart = tok.posStart;
    this.posEnd = tok.posEnd;
  }

  toString(): string {
    return `${this.tok}`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

// binary operation node
export class BinOpNode implements Positioned {
  posStart: Position;
  posEnd: Position;

  constructor(
    public leftNode: Node,
    public opToken: Token,
    public rightNode: Node,
  ) {
    this.posStart = leftNode.posStart;
    this.posEnd = rightNode.posEnd;
  }

  toString(): string {
    return `(${this.leftNode}, ${this.opToken}, ${this.rightNode})`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

export class UnaryOpNode implements Positioned {
  posStart: Position;
  posEnd: Position;

  constructor(
    public opTok: Token,
    public node: Node,
  ) {
    this.posStart = opTok.posStart;
    this.posEnd = node.posEnd;
  }

  toString(): string {
    return `(${this.opTok}, ${this.node})`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

export class BooleanNode implements Positioned {
  posStart: Position;
  posEnd: Position;

  constructor(public tok: Token) {
    this.posStart = tok.posStart;
    this.posEnd = tok.posEnd;
  }

  toString(): string {
    return `${this.tok}`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

// Reads a previously-assigned variable's value (e.g. the "a" in "a + 1").
export class VarAccessNode implements Positioned {
  posStart: Position;
  posEnd: Position;

  constructor(public tok: Token) {
    this.posStart = tok.posStart;
    this.posEnd = tok.posEnd;
  }

  toString(): string {
    return `${this.tok}`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

export class VarAssignNode implements Positioned {
  posStart: Position;

  constructor(
    public varNameTok: Token,
    public valueNode: Node,
    public bodyNode: Node,
  ) {
    this.posStart = varNameTok.posStart;
  }

  get posEnd(): Position {
    return this.bodyNode.posEnd;
  }

  toString(): string {
    return `(VAR:${this.varNameTok.value}, ${this.valueNode}, ${this.bodyNode})`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

export interface IfCase {
  condition: Node;
  value: Node;
}

export class IfNode implements Positioned {
  posStart: Position;
  posEnd: Position;

  constructor(
    public cases: IfCase[],
    public elseCase: Node,
    posStart: Position,
  ) {
    this.posStart = posStart;
    this.posEnd = elseCase.posEnd;
  }

  toString(): string {
    const cases = this.cases.map((c) => `${c.condition} -> ${c.value}`).join(", ");
    return `(IF ${cases} ELSE ${this.elseCase})`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

export type MatchLabel = NumberNode | StringNode;

export interface MatchCase {
  labels: MatchLabel[];
  value: Node;
}

export class MatchNode implements Positioned {
  posStart: Position;
  posEnd: Position;

  constructor(
    public input: Node,
    public cases: MatchCase[],
    public elseCase: Node,
    posStart: Position,
  ) {
    this.posStart = posStart;
    this.posEnd = elseCase.posEnd;
  }

  toString(): string {
    const cases = this.cases
      .map((c) => `${c.labels.map((label) => `${label}`).join(", ")} -> ${c.value}`)
      .join(", ");
    return `(MATCH ${this.input} ${cases} ELSE ${this.elseCase})`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

export class CallNode implements Positioned {
  posStart: Position;
  posEnd: Position;

  constructor(
    public nameTok: Token,
    public args: Node[],
    posEnd: Position,
  ) {
    this.posStart = nameTok.posStart;
    this.posEnd = posEnd;
  }

  toString(): string {
    return `CALL:${this.nameTok.value}(${this.args.join(", ")})`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

// A namespaced zero-argument operator access, e.g. "math.e" or "camera.zoom".
export class ConstantNode implements Positioned {
  posStart: Position;
  posEnd: Position;

  constructor(
    public namespaceTok: Token,
    public memberTok: Token,
  ) {
    this.posStart = namespaceTok.posStart;
    this.posEnd = memberTok.posEnd;
  }

  toString(): string {
    return `CONST:${this.namespaceTok.value}.${this.memberTok.value}`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

export class LinearInterpolationNode implements Positioned {
  posStart: Position;
  posEnd: Position;

  constructor(tok: Token) {
    this.posStart = tok.posStart;
    this.posEnd = tok.posEnd;
  }

  toString(): string {
    return "LINEAR";
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

export class ExponentialInterpolationNode implements Positioned {
  constructor(
    public base: Node,
    public posStart: Position,
    public posEnd: Position,
  ) {}

  toString(): string {
    return `EXPONENTIAL(${this.base})`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

export class CubicBezierInterpolationNode implements Positioned {
  constructor(
    public x1: Node,
    public y1: Node,
    public x2: Node,
    public y2: Node,
    public posStart: Position,
    public posEnd: Position,
  ) {}

  toString(): string {
    return `CUBIC_BEZIER(${this.x1}, ${this.y1}, ${this.x2}, ${this.y2})`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

export type InterpolationType =
  LinearInterpolationNode | ExponentialInterpolationNode | CubicBezierInterpolationNode;

export interface InterpolateStop {
  input: NumberNode;
  value: Node;
}

export class InterpolateNode implements Positioned {
  posStart: Position;
  posEnd: Position;

  constructor(
    public variant: "interpolate" | "interpolateHcl" | "interpolateLab",
    public interpolationType: InterpolationType,
    public input: Node,
    public stops: InterpolateStop[],
    posStart: Position,
  ) {
    const lastStop = stops.at(-1);
    if (lastStop === undefined) {
      throw new Error("InterpolateNode requires at least one stop");
    }
    this.posStart = posStart;
    this.posEnd = lastStop.value.posEnd;
  }

  toString(): string {
    const label =
      this.variant === "interpolate"
        ? "INTERPOLATE"
        : this.variant === "interpolateHcl"
          ? "INTERPOLATE_HCL"
          : "INTERPOLATE_LAB";
    const stops = this.stops.map((s) => `${s.input} -> ${s.value}`).join(", ");
    return `(${label} ${this.interpolationType} ${this.input} ${stops})`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

export interface StepStop {
  input: NumberNode;
  value: Node;
}

export class StepNode implements Positioned {
  posStart: Position;
  posEnd: Position;

  constructor(
    public input: Node,
    public defaultValue: Node,
    public stops: StepStop[],
    posStart: Position,
  ) {
    const lastStop = stops.at(-1);
    if (lastStop === undefined) {
      throw new Error("StepNode requires at least one stop");
    }
    this.posStart = posStart;
    this.posEnd = lastStop.value.posEnd;
  }

  toString(): string {
    const stops = this.stops.map((s) => `${s.input} -> ${s.value}`).join(", ");
    return `(STEP ${this.input} DEFAULT ${this.defaultValue} ${stops})`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}

export class GetNode implements Positioned {
  constructor(
    public tok: Token,
    public posStart: Position,
    public posEnd: Position,
  ) {}

  toString(): string {
    return `GET:${this.tok.value}`;
  }

  [NODE_INSPECT_CUSTOM](): string {
    return this.toString();
  }
}
