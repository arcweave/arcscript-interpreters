class _RuntimeError extends Error {
  /**
   * RuntimeError constructor
   * @param {string}      message
   * @param {object|null} node      The node object { line, col } to determine the exact pos of the error
   */
  constructor(message, node = null) {
    let m = message;
    if (node) {
      const { line, col } = node;
      m += ` at line ${line}, col ${col}`;
    }
    super(m);
    this.name = 'RuntimeError';
  }
}

export default _RuntimeError;
