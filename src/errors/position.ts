export class Position {
  constructor(
    public idx: number,
    public ln: number,
    public col: number,
  ) {}

  advance(currentChar: string | undefined): void {
    this.idx++;
    this.col++;
    if (currentChar === "\n") {
      this.ln++;
      this.col = 0;
    }
  }

  copy(): Position {
    return new Position(this.idx, this.ln, this.col);
  }
}
