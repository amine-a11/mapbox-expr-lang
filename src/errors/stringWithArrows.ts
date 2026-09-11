import type { Position } from "./position";

export function stringWithArrows(text: string, posStart: Position, posEnd: Position): string {
  let result = "";

  let lineStart = Math.max(text.lastIndexOf("\n", posStart.idx - 1), 0);
  let lineEnd = text.indexOf("\n", lineStart + 1);
  if (lineEnd < 0) lineEnd = text.length;

  const lineCount = posEnd.ln - posStart.ln + 1;
  for (let i = 0; i < lineCount; i++) {
    const line = text.slice(lineStart, lineEnd);
    const colStart = i === 0 ? posStart.col : 0;
    const colEnd = i === lineCount - 1 ? posEnd.col : line.length;

    result += `${line}\n`;
    result += " ".repeat(colStart) + "^".repeat(Math.max(colEnd - colStart, 1));
    if (i < lineCount - 1) result += "\n";

    lineStart = lineEnd;
    lineEnd = text.indexOf("\n", lineStart + 1);
    if (lineEnd < 0) lineEnd = text.length;
  }

  return result.replaceAll("\t", "");
}
