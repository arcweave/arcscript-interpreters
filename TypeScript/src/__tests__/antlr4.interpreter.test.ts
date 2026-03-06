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
