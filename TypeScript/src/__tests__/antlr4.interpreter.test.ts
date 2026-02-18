import { expect, test, describe, vi } from 'vitest';
import { Interpreter, ParseError, RuntimeError } from '../index.js';
import validTests from './valid.json';
import parseErrorTests from './parseErrors.json';
import runtimeErrorTests from './runtimeErrors.json';
import conditionTests from './conditions.json';
import replaceVariableTests from './replaceVariables.json';
import stringTests from './stringConcat.json';
import { VarObject, VarValue } from '../types.js';

type TestCase = {
  code: string;
  changes?: Record<string, VarValue>;
  output?: string;
  events?: { name: string; args: unknown }[];
  visits?: Record<string, number>;
  elementId?: string;
  result?: unknown;
  variableChanges?: Record<string, string>;
};

function setVarValues(vars: Record<string, VarObject>) {
  return Object.fromEntries(
    Object.entries(vars)
      .filter(([, v]) => !v.children)
      .map(([k, v]) => [k, v.value])
  );
}

describe('Interprete valid scripts', () => {
  const varObjects = validTests.initialVars as Record<string, VarObject>;
  const varValues = setVarValues(varObjects);
  const cases = validTests.cases as TestCase[];

  test.each(cases)(
    'Tests script: $code',
    ({
      code,
      changes: expectedChanges = {},
      output: expectedOutput = '',
      events = null,
      visits = {},
      elementId = '',
    }) => {
      const eventHandler = vi.fn();

      const interpreter = new Interpreter(
        varValues,
        varObjects,
        visits,
        elementId,
        eventHandler
      );
      const { changes, output } = interpreter.runScript(code);
      expect(changes).toMatchObject(expectedChanges);
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

describe('Interprete string test scripts', () => {
  const varObjects = stringTests.initialVars as Record<string, VarObject>;
  const varValues = setVarValues(varObjects);

  test.each(stringTests.cases as unknown as TestCase[])(
    'Tests script: $code',
    ({
      code,
      changes: expectedChanges = {},
      output: expectedOutput = '',
      visits,
      elementId = '',
    }) => {
      const interpreter = new Interpreter(
        varValues,
        varObjects,
        visits,
        elementId
      );
      const { changes, output } = interpreter.runScript(code);
      expect(changes).toMatchObject(expectedChanges);
      expect(output).toEqual(expectedOutput);
    }
  );
});

describe('Interprete script with parse errors', () => {
  const varObjects = parseErrorTests.initialVars as Record<string, VarObject>;
  const varValues = setVarValues(varObjects);

  test.each(parseErrorTests.cases as TestCase[])(
    'Test error script: $code',
    ({ code, visits, elementId = '' }) => {
      const interpreter = new Interpreter(
        varValues,
        varObjects,
        visits,
        elementId
      );
      expect(() => {
        interpreter.parse(code);
      }).toThrow(ParseError);
    }
  );
});

describe('Interprete script with runtime errors', () => {
  const varObjects = runtimeErrorTests.initialVars as Record<string, VarObject>;
  const varValues = setVarValues(varObjects);

  test.each(runtimeErrorTests.cases as TestCase[])(
    'Test error script: $code',
    ({ code, visits, elementId = '' }) => {
      const interpreter = new Interpreter(
        varValues,
        varObjects,
        visits,
        elementId
      );
      expect(() => {
        interpreter.runScript(code);
      }).toThrow(RuntimeError);
    }
  );
});

describe('Interprete condition', () => {
  const varObjects = conditionTests.initialVars as Record<string, VarObject>;
  const varValues = setVarValues(varObjects);

  test.each(conditionTests.cases as TestCase[])(
    'Tests condition: $code',
    ({ code, visits, elementId = '', result: expectedResult }) => {
      const interpreter = new Interpreter(
        varValues,
        varObjects,
        visits,
        elementId
      );
      const { result } = interpreter.runScript(code);

      expect(result.condition).toStrictEqual(expectedResult);
    }
  );
});

describe('Replace variables', () => {
  const varObjects = replaceVariableTests.initialVars as Record<
    string,
    VarObject
  >;
  const varValues = setVarValues(varObjects);

  test.each(replaceVariableTests.cases as TestCase[])(
    'Tests replace: $code',
    ({ code, variableChanges = {}, result: expectedResult }) => {
      // Parse and check the condition
      const interpreter = new Interpreter(varValues, varObjects);
      const result = interpreter.replaceVariables(code, variableChanges);

      // The given condition should match the expected evaluation
      expect(result).toStrictEqual(expectedResult);
    }
  );
});
