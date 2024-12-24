import { ParseError, RuntimeError } from './errors/index.js';
import ArcscriptState from './ArcscriptState.js';

export default class ArcscriptFunctions {
  /**
   * @param {ArcscriptState} state
   */
  constructor(state) {
    this.state = state;
  }

  sqrt(...args) {
    const n = args[0];
    this.assertNumber('sqrt', n);
    const result = Math.sqrt(n);
    if (Number.isNaN(result)) {
      throw new RuntimeError(
        `Invalid call to function sqrt with argument: ${n}`
      );
    }
    return result;
  }

  sqr(...args) {
    const n = args[0];
    this.assertNumber('sqr', n);
    return n * n;
  }

  abs(...args) {
    const n = args[0];
    this.assertNumber('abs', n);
    return Math.abs(n);
  }

  random(...args) {
    return Math.random();
  }

  roll(...args) {
    // Default value for the number of rolls is 1
    const maxRoll = args[0];
    const rolls = args[1] || 1;

    this.assertPositiveInteger('roll', maxRoll);
    this.assertPositiveInteger('roll', rolls);
    // Perform several dice rolls
    let rollSum = 0;
    for (let i = 0; i < rolls; i += 1) {
      rollSum += Math.floor(Math.random() * maxRoll) + 1;
    }
    return rollSum;
  }

  show(...args) {
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

  reset(...args) {
    const ids = args.map(name => {
      const v = this.state.getVar(name);
      return v.id;
    });
    this.state.resetVarValues(ids);
  }

  resetAll(...args) {
    const except = args.map(name => {
      const v = this.state.getVar(name);
      return v.id;
    });
    const all = Object.keys(this.state.getInitialVarValues());
    const resetIds = all.filter(id => !except.includes(id));
    this.state.resetVarValues(resetIds);
  }

  round(...args) {
    const num = args[0];
    this.assertNumber('round', num);
    return Math.round(num);
  }

  min(...args) {
    args.forEach(arg => this.assertNumber('min', arg));
    return Math.min(...args);
  }

  max(...args) {
    args.forEach(arg => this.assertNumber('max', arg));
    return Math.max(...args);
  }

  visits(...args) {
    let elementId = this.state.currentElement;
    if (args.length > 0) {
      const mention = args[0];
      elementId = mention.attrs['data-id'];
    }
    return this.state.elementVisits[elementId];
  }

  /**
   * Checks if the function argument is a number
   * @param {string} name         The function name
   * @param {mixed}  arg          The argument to check
   */
  assertNumber(name, arg) {
    if (Number.isNaN(arg)) {
      throw new RuntimeError(
        `Invalid argument ${arg} in function ${name}. Expected number (integer or float)`
      );
    }
  }

  /**
   * Checks if the function argument is a positive integer
   * @param {string} name         The function name
   * @param {mixed}  arg          The argument to check
   */
  assertPositiveInteger(name, arg) {
    if (arg !== parseInt(arg, 10) || arg <= 0) {
      throw new RuntimeError(
        `Invalid argument ${arg} in function ${name}. Expected positive integer`
      );
    }
  }
}
