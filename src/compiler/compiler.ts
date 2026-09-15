import { BinOpNode, GetNode, NumberNode, UnaryOpNode, type Node } from "../parser/nodes";
import { TokenType } from "../lexer/token";
import { RuntimeError } from "../errors/langError";

export type MapboxExpression = MapboxExpression[] | string | number | boolean | null;

const BINARY_OPERATORS: Partial<Record<TokenType, string>> = {
  [TokenType.PLUS]: "+",
  [TokenType.MINUS]: "-",
  [TokenType.MUL]: "*",
  [TokenType.DIV]: "/",
  [TokenType.MOD]: "%",
  [TokenType.POW]: "^",
};

interface CompiledExpression {
  expr: MapboxExpression;
  constant: number | undefined;
}

function applyOperator(type: TokenType, left: number, right: number): number {
  switch (type) {
    case TokenType.PLUS:
      return left + right;
    case TokenType.MINUS:
      return left - right;
    case TokenType.MUL:
      return left * right;
    case TokenType.DIV:
      return left / right;
    case TokenType.MOD:
      return left % right;
    case TokenType.POW:
      return left ** right;
    default:
      throw new Error(`Compiler: cannot fold unsupported operator ${TokenType[type]}`);
  }
}

export class Compiler {
  constructor(
    public text: string,
    private readonly optimize: boolean = false,
  ) {}

  compile(node: Node): MapboxExpression {
    return this.visit(node).expr;
  }

  private visit(node: Node): CompiledExpression {
    if (node instanceof NumberNode) {
      return this.visitNumberNode(node);
    } else if (node instanceof BinOpNode) {
      return this.visitBinOpNode(node);
    } else if (node instanceof UnaryOpNode) {
      return this.visitUnaryOpNode(node);
    } else if (node instanceof GetNode) {
      return this.visitGetNode(node);
    } else {
      throw new Error("No visit function for " + node);
    }
  }

  private visitGetNode(node: GetNode): CompiledExpression {
    if (typeof node.tok.value !== "string") {
      throw new Error(`GetNode token has a non-string value: ${node.tok}`);
    }
    return { expr: ["get", node.tok.value], constant: undefined };
  }

  private visitNumberNode(node: NumberNode): CompiledExpression {
    if (typeof node.tok.value !== "number") {
      throw new Error(`NumberNode token has a non-numeric value: ${node.tok}`);
    }
    return { expr: node.tok.value, constant: node.tok.value };
  }

  private visitBinOpNode(node: BinOpNode): CompiledExpression {
    const left = this.visit(node.leftNode);
    const right = this.visit(node.rightNode);

    const op = BINARY_OPERATORS[node.opToken.type];
    if (op === undefined) {
      throw new Error(`Compiler.visitBinOpNode: unsupported operator ${node.opToken}`);
    }
    if (right.constant === 0) {
      if (node.opToken.type === TokenType.DIV) {
        throw new RuntimeError(
          node.rightNode.posStart,
          node.rightNode.posEnd,
          "Division by zero",
          this.text,
        );
      }
      if (node.opToken.type === TokenType.MOD) {
        throw new RuntimeError(
          node.rightNode.posStart,
          node.rightNode.posEnd,
          "Modulo by zero",
          this.text,
        );
      }
    }

    const constant =
      left.constant !== undefined && right.constant !== undefined
        ? applyOperator(node.opToken.type, left.constant, right.constant)
        : undefined;

    if (constant !== undefined && !Number.isFinite(constant)) {
      throw new RuntimeError(
        node.posStart,
        node.posEnd,
        `Result is not a finite number: ${constant}`,
        this.text,
      );
    }

    if (this.optimize && constant !== undefined) {
      return { expr: constant, constant };
    }

    if (op === "+" || op === "*") {
      const leftArgs =
        Array.isArray(left.expr) && left.expr[0] === op ? left.expr.slice(1) : [left.expr];
      const rightArgs =
        Array.isArray(right.expr) && right.expr[0] === op ? right.expr.slice(1) : [right.expr];
      return { expr: [op, ...leftArgs, ...rightArgs], constant };
    }

    return { expr: [op, left.expr, right.expr], constant };
  }

  private visitUnaryOpNode(node: UnaryOpNode): CompiledExpression {
    const value = this.visit(node.node);

    if (node.opTok.type === TokenType.MINUS) {
      const constant = value.constant !== undefined ? -value.constant : undefined;

      if (this.optimize && constant !== undefined) {
        return { expr: constant, constant };
      }
      return { expr: ["-", value.expr], constant };
    }
    return value;
  }
}
