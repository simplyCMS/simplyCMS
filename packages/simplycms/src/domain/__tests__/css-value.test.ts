import { describe, expect, it } from 'vitest';
import { isSafeCssValue } from '../css-value';

describe('isSafeCssValue (Е6д-4)', () => {
  it.each(['rgba(0,0,0,0.4)', '#112233', 'var(--x)'])('приймає %s', (v) => {
    expect(isSafeCssValue(v)).toBe(true);
  });

  it.each(['red; background:url(x)', 'a{', '/* x', '', '   ', '<b>'])(
    'відхиляє %j',
    (v) => {
      expect(isSafeCssValue(v)).toBe(false);
    },
  );

  it('ліміт довжини: 100 так, 101 ні; Infinity знімає ліміт', () => {
    expect(isSafeCssValue('a'.repeat(100))).toBe(true);
    expect(isSafeCssValue('a'.repeat(101))).toBe(false);
    expect(isSafeCssValue('a'.repeat(101), Infinity)).toBe(true);
  });

  it('не-рядок відхиляється', () => {
    expect(isSafeCssValue(undefined)).toBe(false);
    expect(isSafeCssValue(5)).toBe(false);
  });
});
