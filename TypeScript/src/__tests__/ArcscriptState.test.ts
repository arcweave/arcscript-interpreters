import { describe, expect, test } from 'vitest';
import ArcscriptState from '../ArcscriptState.js';
import { ArcscriptStateDef } from '../types.js';

function createState(stateDef: ArcscriptStateDef = {}): ArcscriptState {
  return new ArcscriptState(stateDef, {}, '', () => {});
}

describe('variable record keys', () => {
  test.each(['__proto__', 'constructor', 'toString'])(
    'supports the variable id %s',
    id => {
      const stateDef = Object.fromEntries([
        [
          id,
          {
            id,
            name: 'variable',
            type: 'integer',
            defaultValue: 1,
          },
        ],
      ]) as ArcscriptStateDef;
      const state = createState(stateDef);

      state.setVarValues(Object.fromEntries([[id, 2]]));

      expect(state.getVar('variable').id).toBe(id);
      expect(Object.hasOwn(state.getChanges(), id)).toBe(true);
      expect(state.getChanges()[id]).toBe(2);
    }
  );

  test('ignores override keys that are only inherited record properties', () => {
    const state = createState();

    expect(() => state.setVarValues({ toString: 2 })).not.toThrow();
    expect(state.getChanges()).toEqual({});
  });
});
