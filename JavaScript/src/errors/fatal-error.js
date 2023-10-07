/**
 * Custom error class for fatal errors
 */
class _FatalError extends Error {
  /**
   * FatalError constructor
   * @param {string}  message
   */
  constructor(message) {
    super(message);
    this.name = 'FatalError';
  }
}

export default _FatalError;
