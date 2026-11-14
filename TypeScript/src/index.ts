import Interpreter from './antlr4.interpreter.js';
import { RuntimeError, ParseError, FatalError } from './errors/index.js';
import type {
  LegacyVariableRewriteOptions,
  LegacyVariableRewriteResult,
} from './types.js';

export { Interpreter, RuntimeError, ParseError, FatalError };
export type { LegacyVariableRewriteOptions, LegacyVariableRewriteResult };
export type { ArcscriptInterpreterOptions } from './antlr4.interpreter.js';
export type {
  ArcscriptEnumDefs,
  EnumDef,
  EnumMemberDef,
  ArcscriptStateDef,
  VarDef,
  VarType,
  VarValue,
} from './types.js';
