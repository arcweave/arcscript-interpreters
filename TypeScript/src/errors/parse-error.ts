/**
 * Custom error class for parser errors
 */
export default class ParseError extends Error {
  constructor(
    message: string,
    node: { line: number; col: number } | null = null
  ) {
    let m = message;
    if (node) {
      const { line, col } = node;
      m += ` at line ${line}, col ${col}`;
    }
    super(m);
    this.name = 'ParseError';
  }
}
