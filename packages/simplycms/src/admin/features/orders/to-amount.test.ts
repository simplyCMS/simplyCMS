import { describe, expect, it } from 'vitest';
import { toAmount } from './to-amount';

describe('toAmount', () => {
  it('decimal string to number', () => {
    expect(toAmount('1234.50')).toBe(1234.5);
  });
  it('null gives 0', () => {
    expect(toAmount(null)).toBe(0);
  });
  it('non-numeric string gives 0, not NaN', () => {
    expect(toAmount('abc')).toBe(0);
  });
});
