import { describe, expect, it } from 'vitest';
import { coreRangeFor, satisfies } from '../semver/index';

describe('coreRangeFor', () => {
  it('1.x → ^M.0.0, незалежно від мінора й патча', () => {
    expect(coreRangeFor('1.0.0')).toBe('^1.0.0');
    expect(coreRangeFor('1.4.2')).toBe('^1.0.0');
    expect(coreRangeFor('2.3.1')).toBe('^2.0.0');
  });

  it('0.x → ^0.m.0 (caret фіксує мінор)', () => {
    expect(coreRangeFor('0.14.0')).toBe('^0.14.0');
    expect(coreRangeFor('0.14.7')).toBe('^0.14.0');
  });

  it('невалідний рядок — виняток', () => {
    expect(() => coreRangeFor('abc')).toThrow(/Невалідна/);
    expect(() => coreRangeFor('1.0')).toThrow(/Невалідна/);
  });

  it('діапазон з 1.0.0 приймає 1.x і не приймає 2.0.0 та 0.x', () => {
    const range = coreRangeFor('1.0.0');
    expect(satisfies('1.0.0', range)).toBe(true);
    expect(satisfies('1.9.3', range)).toBe(true);
    expect(satisfies('2.0.0', range)).toBe(false);
    expect(satisfies('0.14.0', range)).toBe(false);
  });
});
