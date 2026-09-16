import {
  BinOpNode,
  BooleanNode,
  GetNode,
  IfNode,
  NumberNode,
  StringNode,
  UnaryOpNode,
  VarAccessNode,
  VarAssignNode,
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

// Returns the type a node is provably NOT a boolean as, or undefined when
// it might be boolean (or we can't tell -- get(), variables, if-results).
function nonBooleanType(node: Node): "number" | "string" | undefined {
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
  return undefined;
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
          `'if'/'elif' condition must be a boolean, but this is a ${badType}`,
          this.text,
        );
      }
      parts.push(this.compile(condition), this.compile(value));
    }
    parts.push(this.compile(node.elseCase));
    return ["case", ...parts];
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
          `'${node.opToken.value}' requires a boolean operand, but this is a ${leftBadType}`,
          this.text,
        );
      }
      const rightBadType = nonBooleanType(node.rightNode);
      if (rightBadType !== undefined) {
        throw new TypeMismatchError(
          node.rightNode.posStart,
          node.rightNode.posEnd,
          `'${node.opToken.value}' requires a boolean operand, but this is a ${rightBadType}`,
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
          `'not' requires a boolean operand, but this is a ${badType}`,
          this.text,
        );
      }
      return ["!", value];
    }

    return value;
  }
}
