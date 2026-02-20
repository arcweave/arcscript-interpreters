import { RuntimeError } from './errors/index.js';
import ArcscriptState from './ArcscriptState.js';
import { MentionResult, VarValue } from './types.js';
import ArcscriptVariable from './ArcscriptVariable.js';

export type FunctionName = keyof ArcscriptFunctions;

type VoidFunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: ArgumentTypes) => void
    ? ReturnType<T[K]> extends void
      ? K
      : never
    : never;
}[keyof T];

export type ArcscriptVoidFunctionKeys = VoidFunctionKeys<ArcscriptFunctions>;

export type ArcscriptNonVoidFunctionKeys = Exclude<
  FunctionName,
  ArcscriptVoidFunctionKeys
>;

type ArgumentTypes = (VarValue | MentionResult | ArcscriptVariable)[];

export default class ArcscriptFunctions {
  private state: ArcscriptState;

  constructor(state: ArcscriptState) {
    this.state = state;
  }

  sqrt(...args: ArgumentTypes): number {
    this.assertNumber('sqrt', args[0]);
    const n = args[0] as number;
    const result = Math.sqrt(n);
    if (Number.isNaN(result)) {
      throw new RuntimeError(
        `Invalid call to function sqrt with argument: ${n}`
      );
    }
    return result;
  }

  sqr(...args: ArgumentTypes): number {
    this.assertNumber('sqr', args[0]);
    const n = args[0] as number;
    return n * n;
  }

  abs(...args: ArgumentTypes): number {
    this.assertNumber('abs', args[0]);
    const n = args[0] as number;
    return Math.abs(n);
  }

  random(): number {
    return Math.random();
  }

  roll(...args: ArgumentTypes): number {
    // Default value for the number of rolls is 1
    const maxRoll = args[0];
    const rolls = args[1] || 1;

    this.assertPositiveInteger('roll', maxRoll);
    this.assertPositiveInteger('roll', rolls);
    const maxRollNum = maxRoll as number;
    const rollsNum = rolls as number;

    // Perform several dice rolls
    let rollSum = 0;
    for (let i = 0; i < rollsNum; i += 1) {
      rollSum += Math.floor(Math.random() * maxRollNum) + 1;
    }
    return rollSum;
  }

  show(...args: ArgumentTypes): void {
    let result = args.join('');
    result = result.replace(/\\([abfnrtv'"])/g, (match, p1) => {
      switch (p1) {
        case 'a':
          return '\x07';
        case 'b':
          return '\b';
        case 'f':
          return '\f';
        case 'n':
          return '\n';
        case 'r':
          return '\r';
        case 't':
          return '\t';
        case 'v':
          return '\v';
        case "'":
          return "'";
        case '"':
          return '"';
        default:
          return match;
      }
    });
    this.state.pushOutput(`<p>${result}</p>`, true);
  }

  reset(...args: ArgumentTypes): void {
    const ids = args.map(name => {
      if (typeof name !== 'string' || !this.state.getVar(name)) {
        throw new RuntimeError(
          `Invalid argument ${name} in function reset. Expected a variable`
        );
      }
      const v = this.state.getVar(name);
      if (!v) {
        throw new RuntimeError(`Variable ${name} not found`);
      }
      return v.id;
    });
    this.state.resetVarValues(ids);
  }

  resetAll(...args: ArgumentTypes): void {
    const except = args.map(name => {
      if (typeof name !== 'string' || !this.state.getVar(name)) {
        throw new RuntimeError(
          `Invalid argument ${name} in function resetAll. Expected a variable`
        );
      }
      const v = this.state.getVar(name);
      if (!v) {
        throw new RuntimeError(`Variable ${name} not found`);
      }
      return v.id;
    });
    const all = Object.keys(this.state.scopedVariables).flatMap(scope =>
      Object.keys(this.state.scopedVariables[scope])
    );
    const resetIds = all.filter(id => !except.includes(id));
    this.state.resetVarValues(resetIds);
  }

  round(...args: ArgumentTypes): number {
    const num = args[0];
    this.assertNumber('round', num);
    const n = num as number;
    return Math.round(n);
  }

  min(...args: ArgumentTypes): number {
    args.forEach(arg => this.assertNumber('min', arg));
    return Math.min(...(args as number[]));
  }

  max(...args: ArgumentTypes): number {
    args.forEach(arg => this.assertNumber('max', arg));
    return Math.max(...(args as number[]));
  }

  visits(...args: ArgumentTypes): number {
    let elementId = this.state.currentElement;
    if (args.length > 0) {
      const mention = args[0] as MentionResult;
      if (
        typeof mention !== 'object' ||
        typeof mention.attrs['data-id'] !== 'string'
      ) {
        throw new RuntimeError(
          `Invalid argument ${mention} in function visits. Expected an element mention`
        );
      }
      if (!(mention.attrs['data-id'] in this.state.elementVisits)) {
        throw new RuntimeError(
          `Invalid mention id: ${mention.attrs['data-id']}`
        );
      }
      elementId = mention.attrs['data-id'];
    }
    return this.state.elementVisits[elementId];
  }

  resetVisits(): void {
    this.state.resetVisits();
  }

  /**
   * Checks if the function argument is a number
   * @param {string} name         The function name
   * @param {VarValue}  arg          The argument to check
   */
  private assertNumber(
    name: string,
    arg: VarValue | MentionResult | ArcscriptVariable
  ) {
    if (typeof arg !== 'number' || Number.isNaN(arg)) {
      throw new RuntimeError(
        `Invalid argument ${arg} in function ${name}. Expected number (integer or float)`
      );
    }
  }

  /**
   * Checks if the function argument is a positive integer
   * @param {string} name         The function name
   * @param {VarValue}  arg       The argument to check
   */
  private assertPositiveInteger(
    name: string,
    arg: VarValue | MentionResult | ArcscriptVariable
  ) {
    if (typeof arg !== 'number' || Number.isNaN(arg)) {
      throw new RuntimeError(
        `Invalid argument ${arg} in function ${name}. Expected number (integer)`
      );
    }
    if (arg <= 0) {
      throw new RuntimeError(
        `Invalid argument ${arg} in function ${name}. Expected positive integer`
      );
    }
  }
}
