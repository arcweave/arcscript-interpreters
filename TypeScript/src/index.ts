import Interpreter from './antlr4.interpreter.js';
import { RuntimeError, ParseError, FatalError } from './errors/index.js';
import type {
  LegacyVariableRewriteOptions,
  LegacyVariableRewriteResult,
} from './types.js';

export { Interpreter, RuntimeError, ParseError, FatalError };
export type { LegacyVariableRewriteOptions, LegacyVariableRewriteResult };
