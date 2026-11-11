import { describe, expect, test, vi } from 'vitest';
import { Interpreter, ParseError } from '../index.js';
import type {
  ArcscriptEnumDefs,
  ArcscriptStateDef,
  VarValue,
} from '../index.js';
import fixture from '../../../tests/enums.json';
import ArcscriptContext from '../ArcscriptContext.js';

type EnumCase = {
  name: string;
  code: string;
  changes?: Record<string, VarValue>;
  output?: string;
  values?: Record<string, VarValue>;
  result?: boolean;
  error?: string;
  errorContains?: string;
  errorLocation?: { line: number; col: number };
  parseOnly?: boolean;
  enums?: ArcscriptEnumDefs;
  initialVars?: ArcscriptStateDef;
  scopeNames?: string[];
};

describe('shared enum contract', () => {
  test.each(fixture.cases as EnumCase[])('$name', testCase => {
    const state = structuredClone(
      testCase.initialVars ?? fixture.initialVars
    ) as ArcscriptStateDef;
    for (const [id, value] of Object.entries(testCase.values ?? {}))
      state[id].value = value;
    const eventHandler = vi.fn();
    const interpreter = new Interpreter({
      state,
      enums: testCase.enums ?? (fixture.enums as ArcscriptEnumDefs),
      scopeNames: testCase.scopeNames,
      eventHandler,
    });
    const original = structuredClone(state);
    if (testCase.error) {
      for (const operation of [
        () => interpreter.parse(testCase.code),
        () => interpreter.runScript(testCase.code),
      ]) {
        expect(operation).toThrow(ParseError);
        if (testCase.errorContains)
          expect(operation).toThrow(testCase.errorContains);
        if (testCase.errorLocation) {
          const { line, col } = testCase.errorLocation;
          expect(operation).toThrow(
            new RegExp(` at line ${line}, col ${col}$`)
          );
        }
      }
    } else {
      interpreter.parse(testCase.code);
      if (!testCase.parseOnly) {
        const result = interpreter.runScript(testCase.code);
        expect(result.output).toBe(testCase.output ?? '');
        if (testCase.changes) expect(result.changes).toEqual(testCase.changes);
        if (testCase.result !== undefined)
          expect(result.result.condition).toBe(testCase.result);
      }
    }
    expect(state).toEqual(original);
    expect(eventHandler).not.toHaveBeenCalled();
  });

  test('returned changes can be restored as primitive overrides', () => {
    const interpreter = new Interpreter({
      state: fixture.initialVars as ArcscriptStateDef,
      enums: fixture.enums as ArcscriptEnumDefs,
    });
    const first = interpreter.runScript(
      '<pre><code>questStatus = QuestStatus.Active</code></pre>'
    );
    const next = interpreter.runScript(
      '<pre><code>show(questStatus)</code></pre>',
      first.changes
    );
    expect(next.output).toBe('<p>active</p>');
    expect(next.changes).toEqual({ status: 'active' });
  });

  test('enum validation errors identify the offending code block', () => {
    const interpreter = new Interpreter({
      state: fixture.initialVars as ArcscriptStateDef,
      enums: fixture.enums as ArcscriptEnumDefs,
    });
    expect(() =>
      interpreter.parse(
        '<pre><code>questStatus = "active"</code></pre><pre><code>show(1)</code></pre>'
      )
    ).toThrow(/ at line 1, col 0$/);
  });

  test('variable and scope rewriting leave enum constants alone', () => {
    const interpreter = new Interpreter({
      state: fixture.initialVars as ArcscriptStateDef,
      enums: fixture.enums as ArcscriptEnumDefs,
    });
    const code =
      '<pre><code>Board.questStatus = QuestStatus.Active</code></pre>';
    expect(
      interpreter.replaceVariables(code, {
        scoped: 'status',
        QuestStatus: 'renamed',
      })
    ).toBe('<pre><code>Board.status = QuestStatus.Active</code></pre>');
    expect(interpreter.replaceScope(code, 'Board', 'OtherBoard')).toBe(
      '<pre><code>OtherBoard.questStatus = QuestStatus.Active</code></pre>'
    );
  });
});

describe('declaration contexts', () => {
  test.each([
    { label: 'default scopes', scopeNames: undefined },
    { label: 'empty scopes', scopeNames: [] },
    { label: 'explicit scopes', scopeNames: ['OtherBoard'] },
  ])(
    'legacy rewriting preserves enum constants with $label',
    ({ scopeNames }) => {
      const state: ArcscriptStateDef = {
        legacy: {
          id: 'legacy',
          name: 'QuestStatus.Active',
          type: 'integer',
          defaultValue: 7,
        },
      };
      const interpreter = new Interpreter({
        state,
        enums: fixture.enums as ArcscriptEnumDefs,
      });
      const code = '<pre><code>show(QuestStatus.Active)</code></pre>';
      const rewrite = interpreter.rewriteLegacyVariableReferences(
        code,
        { legacy: 'renamed' },
        { scopeNames }
      );
      expect(rewrite).toEqual({ code, blockedVariableIds: ['legacy'] });
      expect(interpreter.runScript(code).output).toBe('<p>active</p>');
      state.legacy.name = 'renamed';
      expect(interpreter.runScript(rewrite.code).output).toBe('<p>active</p>');
    }
  );

  test('legacy rewriting protects enum, inferred, constructor, and supplied namespaces together', () => {
    const state: ArcscriptStateDef = {};
    for (const [id, name] of Object.entries({
      enumAlias: 'QuestStatus.Active',
      inferred: 'Board.score',
      constructorScope: 'EmptyBoard.score',
      supplied: 'SuppliedBoard.score',
      unqualifiedLegacy: 'Other.score',
    }))
      state[id] = { id, name, type: 'integer', defaultValue: 7 };
    state.scoped = {
      id: 'scoped',
      name: 'score',
      scope: 'Board',
      type: 'integer',
      defaultValue: 1,
    };
    const interpreter = new Interpreter({
      state,
      enums: fixture.enums as ArcscriptEnumDefs,
      scopeNames: ['EmptyBoard'],
    });
    const rewrite = interpreter.rewriteLegacyVariableReferences(
      '<pre><code>show(QuestStatus.Active, Board.score, EmptyBoard.score, SuppliedBoard.score, Other.score)</code></pre>',
      {
        enumAlias: 'enumRenamed',
        inferred: 'boardRenamed',
        constructorScope: 'emptyRenamed',
        supplied: 'suppliedRenamed',
        unqualifiedLegacy: 'renamed',
      },
      { scopeNames: ['SuppliedBoard'] }
    );
    expect(rewrite).toEqual({
      code: '<pre><code>show(QuestStatus.Active, Board.score, EmptyBoard.score, SuppliedBoard.score, renamed)</code></pre>',
      blockedVariableIds: [
        'constructorScope',
        'enumAlias',
        'inferred',
        'supplied',
      ],
    });
  });

  test.each<{
    code: string;
    replacements: Record<string, string>;
    expected: string;
  }>([
    {
      code: '<p>unchanged</p>',
      replacements: {},
      expected: '<p>unchanged</p>',
    },
    {
      code: '<p>unchanged</p>',
      replacements: { legacy: 'renamed' },
      expected: '<p>unchanged</p>',
    },
    {
      code: '<pre><code>old value</code></pre>',
      replacements: { legacy: 'renamed' },
      expected: '<pre><code>renamed</code></pre>',
    },
  ])(
    'legacy rewriting without an ambiguity probe ignores unrelated declarations: $code',
    ({ code, replacements, expected }) => {
      const enums = structuredClone(fixture.enums) as ArcscriptEnumDefs;
      enums.quest.members = [];
      const interpreter = new Interpreter({
        state: {
          legacy: {
            id: 'legacy',
            name: 'old value',
            type: 'integer',
            defaultValue: 1,
          },
        },
        enums,
      });
      expect(
        interpreter.rewriteLegacyVariableReferences(code, replacements)
      ).toEqual({
        code: expected,
        blockedVariableIds: [],
      });
    }
  );

  test.each(['invalid definition', 'unknown enum', 'scope collision'])(
    'legacy rewriting reports %s instead of misclassifying valid code',
    problem => {
      const state: ArcscriptStateDef = {
        score: { id: 'score', name: 'score', type: 'integer', defaultValue: 1 },
        padded: {
          id: 'padded',
          name: 'score ',
          type: 'integer',
          defaultValue: 2,
        },
      };
      const enums = structuredClone(fixture.enums) as ArcscriptEnumDefs;
      const scopeNames: string[] = [];
      const interpreter = new Interpreter({ state, enums, scopeNames });
      const rewrite = () =>
        interpreter.rewriteLegacyVariableReferences(
          '<pre><code>score + 1</code></pre>',
          { padded: 'renamed' }
        );
      expect(rewrite().blockedVariableIds).toEqual(['padded']);

      if (problem === 'invalid definition') enums.quest.members = [];
      else if (problem === 'unknown enum') state.score.enumId = 'missing';
      else scopeNames.push('QuestStatus');
      expect(rewrite).toThrow(ParseError);
    }
  );

  test('resolved references retain identity and type when source declarations change', () => {
    const enums = structuredClone(fixture.enums) as ArcscriptEnumDefs;
    const variables = structuredClone(fixture.initialVars) as ArcscriptStateDef;
    const context = new ArcscriptContext(enums, variables);
    enums.quest.name = 'RenamedStatus';
    enums.quest.type = 'integer';
    enums.quest.members[1].value = 1;
    variables.status.name = 'renamedStatus';
    variables.status.enumId = 'door';

    expect(context.resolve('questStatus')).toEqual({
      kind: 'variable',
      variableId: 'status',
      type: 'string',
      enumId: 'quest',
    });
    expect(context.resolve('Board.questStatus')).toMatchObject({
      kind: 'variable',
      variableId: 'scoped',
      enumId: 'quest',
    });
    expect(context.resolve('QuestStatus.Active')).toEqual({
      kind: 'enumMember',
      enumId: 'quest',
      memberId: 'active',
      type: 'string',
      value: 'active',
    });
    expect(context.enumType('quest')).toBe('string');
    expect(context.resolve('RenamedStatus.Active')).toBeUndefined();
    expect(() => new ArcscriptContext(enums, variables)).toThrow(ParseError);
  });

  test('a run keeps validated bindings and the next operation reads fresh declarations', () => {
    const enums = structuredClone(fixture.enums) as ArcscriptEnumDefs;
    const state = structuredClone(fixture.initialVars) as ArcscriptStateDef;
    const interpreter = new Interpreter({
      state,
      enums,
      eventHandler: () => {
        state.status.name = 'renamedStatus';
        enums.quest.name = 'RenamedStatus';
        enums.quest.members[1].name = 'Started';
        enums.quest.members[1].value = 'started';
      },
    });
    const result = interpreter.runScript(
      '<pre><code>resetVisits()</code></pre><pre><code>questStatus = QuestStatus.Active</code></pre><pre><code>reset(questStatus)</code></pre><pre><code>questStatus = QuestStatus.Active</code></pre><pre><code>show(questStatus, QuestStatus.Active)</code></pre>'
    );
    expect(result.output).toBe('<p>activeactive</p>');
    expect(result.changes).toEqual({ status: 'active' });
    expect(() =>
      interpreter.parse(
        '<pre><code>questStatus == QuestStatus.Active</code></pre>'
      )
    ).toThrow(ParseError);
    const next = interpreter.runScript(
      '<pre><code>renamedStatus = RenamedStatus.Started</code></pre><pre><code>show(renamedStatus)</code></pre>'
    );
    expect(next.output).toBe('<p>started</p>');
    expect(next.changes).toEqual({ status: 'started' });
    state.status.enumId = 'missing';
    expect(() => interpreter.parse('<pre><code>true</code></pre>')).toThrow(
      ParseError
    );
  });
});
