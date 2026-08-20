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

const ESCAPE_SEQUENCES: Record<string, string> = {
  a: '\x07',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
  "'": "'",
  '"': '"',
  '\\': '\\',
};

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
    const rolls = args[1] ?? 1;

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
    const result = args
      .join('')
      .replace(/\\([abfnrtv'"\\])/g, (_match, escape: string) => {
        return ESCAPE_SEQUENCES[escape];
      });
    this.state.pushOutput(`<p>${result}</p>`, true);
  }

  reset(...args: ArgumentTypes): void {
    args.forEach(variable => {
      if (!(variable instanceof ArcscriptVariable)) {
        throw new RuntimeError(
          `Invalid argument ${variable} in function reset. Expected a variable`
        );
      }
      variable.reset();
    });
  }

  resetAll(...args: ArgumentTypes): void {
    const except = args.map(variable => {
      if (!(variable instanceof ArcscriptVariable)) {
        throw new RuntimeError(
          `Invalid argument ${variable} in function resetAll. Expected a variable`
        );
      }
      return variable.id;
    });
    const variablesToReset = Object.values(this.state.variables).filter(
      v => !except.includes(v.id)
    );
    variablesToReset.forEach(variable => variable.reset());
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
      const mention = args[0];
      if (
        typeof mention !== 'object' ||
        mention === null ||
        !('attrs' in mention) ||
        typeof mention.attrs !== 'object' ||
        mention.attrs === null ||
        typeof mention.attrs['data-id'] !== 'string'
      ) {
        throw new RuntimeError(
          `Invalid argument ${mention} in function visits. Expected an element mention`
        );
      }
      if (
        !Object.prototype.hasOwnProperty.call(
          this.state.elementVisits,
          mention.attrs['data-id']
        )
      ) {
        throw new RuntimeError(
          `Invalid mention id: ${mention.attrs['data-id']}`
        );
      }
      elementId = mention.attrs['data-id'];
    }
    return this.state.elementVisits[elementId] ?? 0;
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
    if (typeof arg !== 'number' || !Number.isInteger(arg) || arg <= 0) {
      throw new RuntimeError(
        `Invalid argument ${arg} in function ${name}. Expected positive integer`
      );
    }
  }
}
