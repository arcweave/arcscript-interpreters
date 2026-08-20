import { afterEach, describe, expect, test, vi } from 'vitest';
import ArcscriptFunctions from '../ArcscriptFunctions.js';
import ArcscriptState from '../ArcscriptState.js';
import { RuntimeError } from '../errors/index.js';

function createFunctions(): ArcscriptFunctions {
  const state = new ArcscriptState({}, {}, '', () => {});
  return new ArcscriptFunctions(state);
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
