/**
 * Custom error class for fatal errors
 */
export default class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FatalError';
  }
}
