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

type TestCase = {
  code: string;
  changes?: Record<string, VarValue> | Record<string, Record<string, VarValue>>;
  output?: string;
  events?: { name: string; args: unknown }[];
  visits?: Record<string, number>;
  elementId?: string;
  result?: unknown;
  variableChanges?: Record<string, string>;
};

describe('Interprete valid scripts', () => {
  const cases = validTests.cases as TestCase[];

  test.each(cases)(
    'Tests script: $code',
    ({
      code,
      changes: expectedChanges,
      output: expectedOutput = '',
      events = null,
      visits = {},
      elementId = '',
    }) => {
      const eventHandler = vi.fn();

      const interpreter = new Interpreter({
        state: validTests.initialVars as ArcscriptStateDef,
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
        state: memberTests.initialVars as ArcscriptStateDef,
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
        state: stringTests.initialVars as ArcscriptStateDef,
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
        state: parseErrorTests.initialVars as ArcscriptStateDef,
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
        state: runtimeErrorTests.initialVars as ArcscriptStateDef,
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
        state: conditionTests.initialVars as ArcscriptStateDef,
        elementVisits: visits,
        currentElement: elementId,
      });
      const { result } = interpreter.runScript(code);

      expect(result.condition).toStrictEqual(expectedResult);
    }
  );
});

describe('Replace variables', () => {
  test.each(replaceVariableTests.cases as TestCase[])(
    'Tests replace: $code',
    ({ code, variableChanges = {}, result: expectedResult }) => {
      // Parse and check the condition
      const interpreter = new Interpreter({
        state: replaceVariableTests.initialVars as ArcscriptStateDef,
      });
      const result = interpreter.replaceVariables(code, variableChanges);

      // The given condition should match the expected evaluation
      expect(result).toStrictEqual(expectedResult);
    }
  );
});
