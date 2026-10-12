import { describe, expect, it } from 'vitest';
import { parsePort } from '../scripts/harness-ports.mjs';

describe('parsePort (стенд harness:up)', () => {
  it('порожнє значення → дефолт', () => {
    expect(parsePort('P', undefined, 4192)).toBe(4192);
    expect(parsePort('P', '', 4192)).toBe(4192);
  });
  it('число приймається', () => {
    expect(parsePort('P', '4194', 4192, { fetchable: true })).toBe(4194);
  });
  it.each(['abc', '12x', '0', '70000', '-1', '4.5'])(
    'нечислове/поза діапазоном %s відхиляється',
    (raw) => {
      expect(() => parsePort('P', raw, 1)).toThrow(/очікується порт/);
    },
  );
  it('4190 для fetch-клієнта відхиляється з посиланням на UPSTREAM:FETCH-BAD-PORT-1', () => {
    expect(() => parsePort('P', '4190', 1, { fetchable: true })).toThrow(
      /FETCH-BAD-PORT-1/,
    );
  });
  it('той самий порт для не-fetch сервісу (SMTP/PG) дозволений', () => {
    expect(parsePort('P', '4190', 1)).toBe(4190);
  });
});
