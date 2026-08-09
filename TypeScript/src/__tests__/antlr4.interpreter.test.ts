import { expect, test, describe, vi } from 'vitest';
import { Interpreter, ParseError, RuntimeError } from '../index.js';
import validTests from './valid.json';
import parseErrorTests from './parseErrors.json';
import runtimeErrorTests from './runtimeErrors.json';
import conditionTests from './conditions.json';
import replaceVariableTests from './replaceVariables.json';
import stringTests from './stringConcat.json';
import memberTests from './member.json';
import { ArcscriptStateDef, VarValue } from '../types.js';
import cloneDeep from 'lodash.clonedeep';

type TestCase = {
  values?: Record<string, Record<string, VarValue>>;
  code: string;
  changes?: Record<string, VarValue>;
  output?: string;
  events?: { name: string; args: unknown }[];
  visits?: Record<string, number>;
  elementId?: string;
  result?: unknown;
  variableChanges?: Record<string, string>;
};

type TestSuite = {
  initialVars: ArcscriptStateDef;
  cases: TestCase[];
};

describe('Interprete valid scripts', () => {
  const cases: TestCase[] = (validTests as unknown as TestSuite).cases;

  test.each(cases)(
    'Tests script: $code',
    ({
      values,
      code,
      changes: expectedChanges,
      output: expectedOutput = '',
      events = null,
      visits = {},
      elementId = '',
    }) => {
      const eventHandler = vi.fn();
      const initVars: ArcscriptStateDef = cloneDeep(
        (validTests as unknown as TestSuite).initialVars
      );
      if (values?.global) {
        Object.entries(values.global as Record<string, VarValue>).forEach(
          ([id, value]) => {
            if (
              initVars[id] &&
              (initVars[id].scope === 'global' ||
                initVars[id].scope === undefined ||
                initVars[id].scope === null)
            ) {
              initVars[id].value = value;
            }
          }
        );
      }
      const interpreter = new Interpreter({
        state: initVars,
        elementVisits: visits,
        currentElement: elementId,
        eventHandler,
      });
      const { changes, output } = interpreter.runScript(code);
      if (expectedChanges !== undefined) {
        expect(changes).toEqual(expectedChanges);
      }
      expect(output).toEqual(expectedOutput);

      if (events) {
        expect(eventHandler).toHaveBeenCalledTimes(events.length);
        events.forEach((event, index) => {
          expect(eventHandler.mock.calls[index][0]).toBe(event.name);
          expect(eventHandler.mock.calls[index][1]).toEqual(event.args);
        });
      }
    }
  );
});

describe('Object members variables', () => {
  test.each(memberTests.cases as TestCase[])(
    'Tests script: $code',
    ({
      code,
      changes: expectedChanges = {},
      output: expectedOutput = '',
      visits,
      elementId = '',
    }) => {
      const interpreter = new Interpreter({
        state: (memberTests as unknown as TestSuite).initialVars,
        elementVisits: visits,
        currentElement: elementId,
      });
      const { changes, output } = interpreter.runScript(code);

      expect(changes).toEqual(expectedChanges);
      expect(output).toEqual(expectedOutput);
    }
  );
});

describe('Global and scoped variables with matching names', () => {
  const initialVars: ArcscriptStateDef = {
    scopedHealth: {
      id: 'scopedHealth',
      name: 'health',
      type: 'integer',
      defaultValue: 10,
      scope: 'global',
    },
    globalHealth: {
      id: 'globalHealth',
      name: 'health',
      type: 'integer',
      defaultValue: 20,
    },
  };

  test('unqualified lookup ignores an earlier variable scoped under the literal global', () => {
    const interpreter = new Interpreter({ state: initialVars });
    const { changes, output } = interpreter.runScript(
      '<pre><code>show(health, " ", global.health)</code></pre><pre><code>health = 21</code></pre><pre><code>global.health = 11</code></pre>'
    );

    expect(output).toBe('<p>20 10</p>');
    expect(changes).toEqual({
      globalHealth: 21,
      scopedHealth: 11,
    });
  });
});

describe('Variable state validation', () => {
  test.each([
    ['defaultValue', { defaultValue: null }],
    ['value', { defaultValue: 1, value: null }],
  ])('rejects a null %s', (_property, values) => {
    const interpreter = new Interpreter({
      state: {
        variable: {
          id: 'variable',
          name: 'variable',
          type: 'integer',
          ...values,
        },
      } as unknown as ArcscriptStateDef,
    });

    expect(() =>
      interpreter.runScript('<pre><code>show(variable)</code></pre>')
    ).toThrow(`Variable variable has null ${_property} property`);
  });

  test('rejects an empty scope', () => {
    const interpreter = new Interpreter({
      state: {
        variable: {
          id: 'variable',
          name: 'variable',
          type: 'integer',
          defaultValue: 1,
          scope: '',
        },
      },
    });

    expect(() =>
      interpreter.runScript('<pre><code>show(variable)</code></pre>')
    ).toThrow('Variable variable has empty scope property');
  });

  test('rejects an undefined defaultValue', () => {
    const interpreter = new Interpreter({
      state: {
        variable: {
          id: 'variable',
          name: 'variable',
          type: 'integer',
          defaultValue: undefined,
        },
      } as unknown as ArcscriptStateDef,
    });

    expect(() =>
      interpreter.runScript('<pre><code>show(variable)</code></pre>')
    ).toThrow('Variable variable is missing defaultValue property');
  });
});

describe('Interprete string test scripts', () => {
  test.each(stringTests.cases as unknown as TestCase[])(
    'Tests script: $code',
    ({
      code,
      changes: expectedChanges = {},
      output: expectedOutput = '',
      visits,
      elementId = '',
    }) => {
      const interpreter = new Interpreter({
        state: (stringTests as unknown as TestSuite).initialVars,
        elementVisits: visits,
        currentElement: elementId,
      });
      const { changes, output } = interpreter.runScript(code);
      expect(changes).toEqual(expectedChanges);
      expect(output).toEqual(expectedOutput);
    }
  );
});

describe('Interprete script with parse errors', () => {
  test.each(parseErrorTests.cases as TestCase[])(
    'Test error script: $code',
    ({ code, visits, elementId = '' }) => {
      const interpreter = new Interpreter({
        state: (parseErrorTests as unknown as TestSuite).initialVars,
        elementVisits: visits,
        currentElement: elementId,
      });
      expect(() => {
        interpreter.parse(code);
      }).toThrow(ParseError);
    }
  );
});

describe('Interprete script with runtime errors', () => {
  test.each(runtimeErrorTests.cases as TestCase[])(
    'Test error script: $code',
    ({ code, visits, elementId = '' }) => {
      const interpreter = new Interpreter({
        state: (runtimeErrorTests as unknown as TestSuite).initialVars,
        elementVisits: visits,
        currentElement: elementId,
      });
      expect(() => {
        interpreter.runScript(code);
      }).toThrow(RuntimeError);
    }
  );
});

describe('Interprete condition', () => {
  test.each(conditionTests.cases as TestCase[])(
    'Tests condition: $code',
    ({ code, visits, elementId = '', result: expectedResult }) => {
      const interpreter = new Interpreter({
        state: (conditionTests as unknown as TestSuite).initialVars,
        elementVisits: visits,
        currentElement: elementId,
      });
      const { result } = interpreter.runScript(code);

      expect(result.condition).toStrictEqual(expectedResult);
    }
  );
});

describe('Replace variables', () => {
  test.each(replaceVariableTests.cases as unknown as TestCase[])(
    'Tests replace: $code',
    ({ code, variableChanges = {}, result: expectedResult }) => {
      // Parse and check the condition
      const interpreter = new Interpreter({
        state: (replaceVariableTests as unknown as TestSuite).initialVars,
      });
      const result = interpreter.replaceVariables(code, variableChanges);

      // The given condition should match the expected evaluation
      expect(result).toStrictEqual(expectedResult);
    }
  );

  test('distinguishes a scope named global from an unqualified global variable', () => {
    const interpreter = new Interpreter({
      state: {
        scopedHealth: {
          id: 'scopedHealth',
          name: 'health',
          type: 'integer',
          defaultValue: 10,
          scope: 'global',
        },
        globalHealth: {
          id: 'globalHealth',
          name: 'health',
          type: 'integer',
          defaultValue: 20,
        },
      },
    });

    const result = interpreter.replaceVariables(
      '<pre><code>health = global.health</code></pre>',
      {
        scopedHealth: 'stamina',
        globalHealth: 'energy',
      }
    );

    expect(result).toBe('<pre><code>energy = global.stamina</code></pre>');
  });
});

describe('Replace scopes', () => {
  test('replaces only scope qualifiers and keeps global variables untouched', () => {
    const interpreter = new Interpreter({
      state: (replaceVariableTests as unknown as TestSuite).initialVars,
    });
    const result = interpreter.replaceScope(
      `<pre><code>boardOne.xyz = 'fourtytwo'</code></pre><pre><code>xyz = boardOne.xyz</code></pre><pre><code>w = "boardOne.xyz"</code></pre>`,
      'boardOne',
      'boardTwo'
    );

    expect(result).toBe(
      `<pre><code>boardTwo.xyz = 'fourtytwo'</code></pre><pre><code>xyz = boardTwo.xyz</code></pre><pre><code>w = "boardOne.xyz"</code></pre>`
    );
  });

  test('supports replacing multiple scopes in one pass', () => {
    const interpreter = new Interpreter({
      state: (replaceVariableTests as unknown as TestSuite).initialVars,
    });
    const result = interpreter.replaceScopes(
      '<pre><code>comp1.x = boardOne.xyz + x</code></pre>',
      {
        comp1: 'comp2',
        boardOne: 'boardTwo',
      }
    );

    expect(result).toBe('<pre><code>comp2.x = boardTwo.xyz + x</code></pre>');
  });
});

describe('Scope inference', () => {
  const initialVars: ArcscriptStateDef = {
    var1: {
      id: 'var1',
      name: 'x',
      type: 'integer',
      defaultValue: 1,
    },
    var2: {
      id: 'var2',
      name: 'y',
      type: 'integer',
      defaultValue: 2,
      scope: null,
    },
    var3: {
      id: 'var3',
      name: 'z',
      type: 'integer',
      defaultValue: 3,
      scope: 'comp1',
    },
  };

  test('infers global for missing and null scope', () => {
    const interpreter = new Interpreter({
      state: initialVars,
    });
    const { changes } = interpreter.runScript(
      '<pre><code>x=5</code></pre><pre><code>y=6</code></pre><pre><code>comp1.z=7</code></pre>'
    );

    expect(changes).toEqual({
      var1: 5,
      var2: 6,
      var3: 7,
    });
  });

  test('replaceVariables infers global for missing and null scope', () => {
    const interpreter = new Interpreter({
      state: initialVars,
    });
    const result = interpreter.replaceVariables(
      '<pre><code>x=y+comp1.z</code></pre>',
      {
        var1: 'a',
        var2: 'b',
        var3: 'c',
      }
    );

    expect(result).toBe('<pre><code>a=b+comp1.c</code></pre>');
  });
});

describe('runScript overrides on subsequent calls', () => {
  test('reuses the same interpreter instance with override changes', () => {
    const initialVars: ArcscriptStateDef = {
      var1: {
        id: 'var1',
        name: 'x',
        type: 'integer',
        defaultValue: 1,
      },
      var2: {
        id: 'var2',
        name: 'y',
        type: 'integer',
        defaultValue: 0,
      },
    };

    const interpreter = new Interpreter({
      state: initialVars,
    });

    const { changes: firstChanges } = interpreter.runScript(
      '<pre><code>x = x + 1</code></pre>'
    );
    expect(firstChanges).toEqual({ var1: 2 });

    const { changes: secondChanges } = interpreter.runScript(
      '<pre><code>y = x + 5</code></pre>',
      firstChanges
    );

    expect(secondChanges).toStrictEqual({ var1: 2, var2: 7 });
  });
});
