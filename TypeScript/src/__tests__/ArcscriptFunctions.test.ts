import { afterEach, describe, expect, test, vi } from 'vitest';
import ArcscriptFunctions from '../ArcscriptFunctions.js';
import ArcscriptState from '../ArcscriptState.js';
import { RuntimeError } from '../errors/index.js';
import { MentionResult } from '../types.js';

function createFunctions(
  elementVisits: Record<string, number> = {},
  currentElement = ''
): ArcscriptFunctions {
  const state = new ArcscriptState({}, elementVisits, currentElement, () => {});
  return new ArcscriptFunctions(state);
}

function createMention(elementId: string): MentionResult {
  return {
    attrs: {
      'data-id': elementId,
      'data-type': 'element',
    },
    label: '',
  };
}

describe('roll', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('defaults to one roll', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(createFunctions().roll(6)).toBe(1);
    expect(random).toHaveBeenCalledTimes(1);
  });

  test('returns the sum of the requested number of rolls', () => {
    const random = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.9999);

    expect(createFunctions().roll(6, 3)).toBe(11);
    expect(random).toHaveBeenCalledTimes(3);
  });

  test.each([
    ['maximum roll', [0]],
    ['maximum roll', [-1]],
    ['number of rolls', [6, 0]],
    ['number of rolls', [6, -1]],
  ])('rejects a non-positive %s', (_description, args) => {
    expect(() => createFunctions().roll(...args)).toThrow(RuntimeError);
    expect(() => createFunctions().roll(...args)).toThrow(
      'Expected positive integer'
    );
  });

  test.each([
    ['maximum roll', [2.5]],
    ['number of rolls', [6, 1.5]],
  ])('rejects a fractional %s', (_description, args) => {
    expect(() => createFunctions().roll(...args)).toThrow(RuntimeError);
    expect(() => createFunctions().roll(...args)).toThrow(
      'Expected positive integer'
    );
  });

  test('rejects non-number arguments', () => {
    expect(() => createFunctions().roll('6')).toThrow(RuntimeError);
    expect(() => createFunctions().roll('6')).toThrow(
      'Expected positive integer'
    );
  });
});

describe('visits', () => {
  test('returns visits for the current element', () => {
    expect(createFunctions({ current: 3 }, 'current').visits()).toBe(3);
  });

  test('returns zero when the current element has no recorded visits', () => {
    expect(createFunctions({}, 'current').visits()).toBe(0);
  });

  test('returns visits for a mentioned element', () => {
    const functions = createFunctions({ current: 3, mentioned: 5 }, 'current');

    expect(functions.visits(createMention('mentioned'))).toBe(5);
  });

  test.each([null, {}, { attrs: null }, { attrs: {} }])(
    'rejects malformed mention argument %#',
    argument => {
      expect(() => functionsWithInvalidArgument(argument)).toThrow(
        RuntimeError
      );
      expect(() => functionsWithInvalidArgument(argument)).toThrow(
        'Expected an element mention'
      );
    }
  );

  test('rejects an unknown mentioned element', () => {
    const functions = createFunctions({ known: 1 });

    expect(() => functions.visits(createMention('unknown'))).toThrow(
      'Invalid mention id: unknown'
    );
  });

  test('does not accept inherited visit properties as element ids', () => {
    const functions = createFunctions({});

    expect(() => functions.visits(createMention('toString'))).toThrow(
      'Invalid mention id: toString'
    );
  });
});

function functionsWithInvalidArgument(argument: unknown): number {
  return createFunctions().visits(argument as MentionResult);
}
