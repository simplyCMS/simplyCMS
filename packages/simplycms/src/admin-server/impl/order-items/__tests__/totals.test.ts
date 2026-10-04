// Е5б-13: грошова арифметика редагування позицій — цілі центи. Рядки
// `numeric` з БД розбираються без `parseFloat`, ціна рушія (`number`, уже
// округлена `roundMoney`) — `Math.round(n * 100)`, межі колонок — окремо.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));

import {
  MAX_CENTS_NUMERIC_10_2,
  MAX_CENTS_NUMERIC_12_2,
  centsFromNumber,
  fromCents,
  toCents,
} from '../totals';

describe('гроші в центах (Е5б-13)', () => {
  it('toCents розбирає десяткові рядки numeric', () => {
    expect(toCents('0')).toBe(0);
    expect(toCents('1234.5')).toBe(123450);
    expect(toCents('1234.50')).toBe(123450);
    expect(toCents('0.01')).toBe(1);
    expect(toCents('9999999999.99')).toBe(999_999_999_999);
  });

  it('toCents відкидає не-гроші й дріб, дрібніший за цент', () => {
    for (const bad of ['', 'abc', '1.234', '-1.00', '1e3', '1,50'])
      expect(() => toCents(bad)).toThrow();
  });

  it('centsFromNumber не дрейфує на float', () => {
    expect(centsFromNumber(0.1 + 0.2)).toBe(30);
    expect(centsFromNumber(1234.55)).toBe(123455);
    expect(centsFromNumber(0)).toBe(0);
  });

  it('fromCents — рядок "x.yy"', () => {
    expect(fromCents(0)).toBe('0.00');
    expect(fromCents(1)).toBe('0.01');
    expect(fromCents(370365)).toBe('3703.65');
    expect(fromCents(999_999_999_999)).toBe('9999999999.99');
    expect(() => fromCents(1.5)).toThrow();
    expect(() => fromCents(-1)).toThrow();
  });

  it('межі колонок: numeric(12,2) і numeric(10,2)', () => {
    expect(MAX_CENTS_NUMERIC_12_2).toBe(toCents('9999999999.99'));
    expect(MAX_CENTS_NUMERIC_10_2).toBe(toCents('99999999.99'));
    expect(MAX_CENTS_NUMERIC_12_2).toBe(999_999_999_999);
    expect(MAX_CENTS_NUMERIC_10_2).toBe(9_999_999_999);
  });
});
