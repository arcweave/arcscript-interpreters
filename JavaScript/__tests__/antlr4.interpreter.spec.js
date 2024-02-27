/* eslint-env jest */
import { Interpreter, ParseError, RuntimeError } from '../src/index.js';
import validTests from './valid.json';
import parseErrorTests from './parseErrors.json';
import runtimeErrorTests from './runtimeErrors.json';
import conditionTests from './conditions.json';
import replaceVariableTests from './replaceVariables.json';

function setVarValues(vars) {
  return Object.fromEntries(
    Object.entries(vars)
      .filter(([k, v]) => !v.children)
      .map(([k, v]) => [k, v.value])
  );
}

describe('Interprete valid scripts', () => {
  const varObjects = validTests.initialVars;
  const varValues = setVarValues(varObjects);

  test.each(validTests.cases)(
    'Tests script: $code',
    ({
      code,
      changes: expectedChanges = {},
      output: expectedOutput = '',
      visits,
      elementId = '',
      result,
    }) => {
      const interpreter = new Interpreter(
        varValues,
        varObjects,
        visits,
        elementId
      );
      const { tree, changes, output } = interpreter.runScript(code);
      expect(changes).toMatchObject(expectedChanges);
      expect(output).toEqual(expectedOutput);
      expect(tree).not.toBeNull();
    }
  );
});

describe('Interprete script with parse errors', () => {
  const varObjects = parseErrorTests.initialVars;
  const varValues = setVarValues(varObjects);

  test.each(parseErrorTests.cases)(
    'Test error script: $code',
    ({
      code,
      changes: expectedChanges = {},
      output: expectedOutput = '',
      visits,
      elementId = '',
      result,
    }) => {
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
  const varObjects = runtimeErrorTests.initialVars;
  const varValues = setVarValues(varObjects);

  test.each(runtimeErrorTests.cases)(
    'Test error script: $code',
    ({
      code,
      changes: expectedChanges = {},
      output: expectedOutput = '',
      visits,
      elementId = '',
      result,
    }) => {
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
  const varObjects = conditionTests.initialVars;
  const varValues = setVarValues(varObjects);

  test.each(conditionTests.cases)(
    'Tests condition: $code',
    ({
      code,
      changes: expectedChanges = {},
      output: expectedOutput = '',
      visits,
      elementId = '',
      result: expectedResult,
    }) => {
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
  const varObjects = replaceVariableTests.initialVars;
  const varValues = setVarValues(varObjects);

  test.each(replaceVariableTests.cases)(
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
