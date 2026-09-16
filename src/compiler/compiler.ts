import {
  BinOpNode,
  BooleanNode,
  GetNode,
  NumberNode,
  UnaryOpNode,
  type Node,
} from "../parser/nodes";
import { TokenType, type Token } from "../lexer/token";

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

// and/or share TokenType.KEYWORD with every other keyword, so they can't go
// in BINARY_OPERATORS (a straight TokenType lookup) the same way symbolic
// operators do -- same reason Parser.matchesOp() needs a (type, value) pair
// instead of just a type for these.
function operatorSymbol(token: Token): string | undefined {
  const symbol = BINARY_OPERATORS[token.type];
  if (symbol !== undefined) return symbol;
  if (token.type === TokenType.KEYWORD && token.value === "and") return "all";
  if (token.type === TokenType.KEYWORD && token.value === "or") return "any";
  return undefined;
}

export class Compiler {
  compile(node: Node): MapboxExpression {
    if (node instanceof NumberNode) return this.visitNumberNode(node);
    else if (node instanceof BooleanNode) return this.visitBooleanNode(node);
    else if (node instanceof BinOpNode) return this.visitBinOpNode(node);
    else if (node instanceof UnaryOpNode) return this.visitUnaryOpNode(node);
    else if (node instanceof GetNode) return this.visitGetNode(node);
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

  private visitBooleanNode(node: BooleanNode): MapboxExpression {
    // Mapbox's boolean type is its own literal value kind (true/false in
    // the JSON), never a number substitute -- confirmed from the style
    // spec's Types reference. So this compiles straight to a real boolean,
    // not 1/0.
    if (node.tok.value !== "true" && node.tok.value !== "false") {
      throw new Error(`BooleanNode token has an unexpected value: ${node.tok}`);
    }
    return node.tok.value === "true";
  }

  private visitBinOpNode(node: BinOpNode): MapboxExpression {
    const left = this.compile(node.leftNode);
    const right = this.compile(node.rightNode);

    const op = operatorSymbol(node.opToken);
    if (op === undefined) {
      throw new Error(`Compiler.visitBinOpNode: unsupported operator ${node.opToken}`);
    }

    if (op === "+" || op === "*" || op === "all" || op === "any") {
      // + and * (and and/or) are variadic in Mapbox, so a chain of the
      // same operator should compile to one flat array, not nested pairs --
      // this is just correctly representing what the operator already is,
      // not an optimization.
      const leftArgs = Array.isArray(left) && left[0] === op ? left.slice(1) : [left];
      const rightArgs = Array.isArray(right) && right[0] === op ? right.slice(1) : [right];
      return [op, ...leftArgs, ...rightArgs];
    }

    return [op, left, right];
  }

  private visitUnaryOpNode(node: UnaryOpNode): MapboxExpression {
    const value = this.compile(node.node);

    if (node.opTok.type === TokenType.MINUS) {
      // Not ["*", -1, value] -- Mapbox's own "-" operator negates when
      // given exactly one argument, so that's the spec-correct form.
      return ["-", value];
    }

    if (node.opTok.type === TokenType.KEYWORD && node.opTok.value === "not") {
      return ["!", value];
    }

    // Unary plus is a no-op.
    return value;
  }
}
