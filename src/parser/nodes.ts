import { inspect } from "node:util";
import type { Token } from "../lexer/token";
import type { Position } from "../errors/position";

export type Node =
  NumberNode | BinOpNode | UnaryOpNode | GetNode | BooleanNode | VarAccessNode | VarAssignNode;

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

  [inspect.custom](): string {
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

  [inspect.custom](): string {
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

  [inspect.custom](): string {
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

  [inspect.custom](): string {
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

  [inspect.custom](): string {
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

  [inspect.custom](): string {
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

  [inspect.custom](): string {
    return this.toString();
  }
}
