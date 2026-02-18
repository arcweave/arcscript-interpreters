export default class RuntimeError extends Error {
  constructor(message: string, node: { line: number; col: number } | null = null) {
    let m = message;
    if (node) {
      const { line, col } = node;
      m += ` at line ${line}, col ${col}`;
    }
    super(m);
    this.name = 'RuntimeError';
  }
}