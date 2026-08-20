import { RuntimeError } from './errors/index.js';
import ArcscriptState from './ArcscriptState.js';
import { MentionResult, VarValue } from './types.js';
import ArcscriptVariable from './ArcscriptVariable.js';

type FunctionName = keyof ArcscriptFunctions;

type VoidFunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: ArgumentTypes) => void
    ? ReturnType<T[K]> extends void
      ? K
      : never
    : never;
}[keyof T];

type ArcscriptVoidFunctionKeys = VoidFunctionKeys<ArcscriptFunctions>;

export type ArcscriptNonVoidFunctionKeys = Exclude<
  FunctionName,
  ArcscriptVoidFunctionKeys
>;

type ArgumentType = VarValue | MentionResult | ArcscriptVariable;
type ArgumentTypes = ArgumentType[];

const ESCAPE_SEQUENCES: Readonly<Record<string, string>> = {
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
  private readonly state: ArcscriptState;

  constructor(state: ArcscriptState) {
    this.state = state;
  }

  sqrt(...args: ArgumentTypes): number {
    const value = args[0];
    this.assertNumber('sqrt', value);
    const result = Math.sqrt(value);
    if (Number.isNaN(result)) {
      throw new RuntimeError(
        `Invalid call to function sqrt with argument: ${value}`
      );
    }
    return result;
  }

  sqr(...args: ArgumentTypes): number {
    const value = args[0];
    this.assertNumber('sqr', value);
    return value * value;
  }

  abs(...args: ArgumentTypes): number {
    const value = args[0];
    this.assertNumber('abs', value);
    return Math.abs(value);
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

    // Perform several dice rolls
    let rollSum = 0;
    for (let i = 0; i < rolls; i += 1) {
      rollSum += Math.floor(Math.random() * maxRoll) + 1;
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
    const variables = this.getVariableArguments('reset', args);
    variables.forEach(variable => variable.reset());
  }

  resetAll(...args: ArgumentTypes): void {
    const except = new Set(
      this.getVariableArguments('resetAll', args).map(variable => variable.id)
    );
    const variablesToReset = Object.values(this.state.variables).filter(
      variable => !except.has(variable.id)
    );
    variablesToReset.forEach(variable => variable.reset());
  }

  round(...args: ArgumentTypes): number {
    const value = args[0];
    this.assertNumber('round', value);
    return Math.round(value);
  }

  min(...args: ArgumentTypes): number {
    this.assertNumbers('min', args);
    return Math.min(...args);
  }

  max(...args: ArgumentTypes): number {
    this.assertNumbers('max', args);
    return Math.max(...args);
  }

  visits(...args: ArgumentTypes): number {
    let elementId = this.state.currentElement;
    if (args.length > 0) {
      const mentionId = this.getElementMentionId(args[0]);
      if (
        !Object.prototype.hasOwnProperty.call(
          this.state.elementVisits,
          mentionId
        )
      ) {
        throw new RuntimeError(`Invalid mention id: ${mentionId}`);
      }
      elementId = mentionId;
    }
    return this.state.elementVisits[elementId] ?? 0;
  }

  resetVisits(): void {
    this.state.resetVisits();
  }

  private getElementMentionId(mention: ArgumentType): string {
    if (
      typeof mention !== 'object' ||
      mention === null ||
      !('attrs' in mention) ||
      typeof mention.attrs !== 'object' ||
      mention.attrs === null ||
      mention.attrs['data-type'] !== 'element' ||
      typeof mention.attrs['data-id'] !== 'string'
    ) {
      throw new RuntimeError(
        `Invalid argument ${mention} in function visits. Expected an element mention`
      );
    }
    return mention.attrs['data-id'];
  }

  private getVariableArguments(
    name: string,
    args: ArgumentTypes
  ): ArcscriptVariable[] {
    return args.map(variable => {
      if (!(variable instanceof ArcscriptVariable)) {
        throw new RuntimeError(
          `Invalid argument ${variable} in function ${name}. Expected a variable`
        );
      }
      return variable;
    });
  }

  /**
   * Checks if the function argument is a number
   * @param {string} name         The function name
   * @param {VarValue}  arg          The argument to check
   */
  private assertNumber(name: string, arg: ArgumentType): asserts arg is number {
    if (typeof arg !== 'number' || Number.isNaN(arg)) {
      throw new RuntimeError(
        `Invalid argument ${arg} in function ${name}. Expected number (integer or float)`
      );
    }
  }

  private assertNumbers(
    name: string,
    args: ArgumentTypes
  ): asserts args is number[] {
    args.forEach(arg => this.assertNumber(name, arg));
  }

  /**
   * Checks if the function argument is a positive integer
   * @param {string} name         The function name
   * @param {VarValue}  arg       The argument to check
   */
  private assertPositiveInteger(
    name: string,
    arg: ArgumentType
  ): asserts arg is number {
    if (typeof arg !== 'number' || !Number.isInteger(arg) || arg <= 0) {
      throw new RuntimeError(
        `Invalid argument ${arg} in function ${name}. Expected positive integer`
      );
    }
  }
}
