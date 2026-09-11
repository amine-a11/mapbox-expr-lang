import { inspect } from "node:util";
import type { Token } from "../lexer/token";

export type Node = NumberNode | BinOpNode | UnaryOpNode;

export class NumberNode {
  constructor(public tok: Token) {}

  toString(): string {
    return `${this.tok}`;
  }

  [inspect.custom](): string {
    return this.toString();
  }
}

// binary operation node
export class BinOpNode {
  constructor(
    public leftNode: Node,
    public opToken: Token,
    public rightNode: Node,
  ) {}

  toString(): string {
    return `(${this.leftNode}, ${this.opToken}, ${this.rightNode})`;
  }

  [inspect.custom](): string {
    return this.toString();
  }
}

export class UnaryOpNode {
  constructor(
    public opTok: Token,
    public node: Node,
  ) {}
  toString(): string {
    return `(${this.opTok}, ${this.node})`;
  }

  [inspect.custom](): string {
    return this.toString();
  }
}
