/**
 * Тема 12: `numeric` у `columnsToZod` — десятковий формат за precision/scale
 * колонки (НАВМИСНЕ суворіше за drizzle-zod; виняток задокументовано в
 * `support/parity-diff.ts`). `'abc'` — помилка валідації на межі (400), а
 * не 22P02 від БД (500).
 */
import { describe, expect, it } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { numeric, pgTable } from 'drizzle-orm/pg-core';
import { sanitizeValidationIssues } from 'simplycms/contracts/domain-errors';
import { shippingRates } from 'simplycms/schema';
import { columnsToZod } from '../columns-to-zod';
import { numericFits } from './support/parity-diff';

const t = pgTable('t', {
  money: numeric('money', { precision: 10, scale: 2 }).notNull(),
  whole: numeric('whole', { precision: 4 }).notNull(),
  free: numeric('free').notNull(),
});
const shape = columnsToZod(t, 'insert');
const ok = (key: 'money' | 'whole' | 'free', v: unknown) =>
  shape[key]!.safeParse(v).success;

describe('numeric(10,2)', () => {
  it.each(['0', '12', '12.5', '12.50', '-1.25', '+3', '.5', '5.', '00012.5'])(
    'приймає %s',
    (v) => expect(ok('money', v)).toBe(true),
  );
  it('межа цілих цифр: 8 так, 9 ні', () => {
    expect(ok('money', '99999999.99')).toBe(true);
    expect(ok('money', '100000000')).toBe(false);
  });
  it('межа дробових: 2 так, 3 ні (без мовчазного округлення)', () => {
    expect(ok('money', '1.99')).toBe(true);
    expect(ok('money', '1.999')).toBe(false);
  });
  it('хвостові нулі понад scale — без втрат, допустимі', () => {
    expect(ok('money', '1.500')).toBe(true);
    expect(ok('money', '1.5000000')).toBe(true);
    expect(ok('money', '0.000')).toBe(true);
    expect(ok('money', '1.501')).toBe(false);
  });
  it.each([
    'abc',
    '',
    '.',
    '1e3',
    ' 1',
    '1 ',
    'NaN',
    'Infinity',
    '--1',
    '1,5',
    '1.2.3',
    '0x10',
  ])('відхиляє %j', (v) => expect(ok('money', v)).toBe(false));
  it('нерядок відхиляється (як і в еталоні)', () => {
    expect(ok('money', 1.5)).toBe(false);
    expect(ok('money', null)).toBe(false);
  });
});

describe('numeric(4) — scale за замовчуванням 0', () => {
  it('4 цілі цифри так, дробова частина ні', () => {
    expect(ok('whole', '9999')).toBe(true);
    expect(ok('whole', '10000')).toBe(false);
    expect(ok('whole', '1.5')).toBe(false);
    expect(ok('whole', '5.')).toBe(true);
    expect(ok('whole', '5.0')).toBe(true);
    expect(ok('whole', '5.10')).toBe(false);
  });
});

describe('numeric без precision — лише формат', () => {
  it('довге число проходить, сміття — ні', () => {
    expect(ok('free', '1234567890123.4567890')).toBe(true);
    expect(ok('free', 'abc')).toBe(false);
  });
});

describe('помилка несе код і параметри для i18n', () => {
  it('invalid_decimal з precision/scale крізь білий список', () => {
    const r = shape.money!.safeParse('abc');
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(sanitizeValidationIssues(r.error.issues)).toEqual([
      {
        path: [],
        code: 'invalid_decimal',
        params: { precision: 10, scale: 2 },
      },
    ]);
  });
});

describe('реальна колонка shipping_rates.base_cost (numeric(10,2))', () => {
  it('insert-схема відхиляє abc (раніше → 22P02/500)', () => {
    const col = getTableColumns(shippingRates).baseCost;
    expect(col).toBeDefined();
    const s = columnsToZod(shippingRates, 'insert').baseCost!;
    expect(s.safeParse('abc').success).toBe(false);
    expect(s.safeParse('5.00').success).toBe(true);
  });
});

describe('незалежна реалізація numericFits (оракул гейта) узгоджена з продакшном', () => {
  it('на сітці значень збігається з columnsToZod', () => {
    const col = getTableColumns(t).money;
    const grid = [
      '0',
      '1.5',
      '.5',
      '5.',
      '.',
      '',
      'x',
      '99999999.99',
      '100000000',
      '1.234',
      '+1',
      '-1',
      '1e3',
      '00000000001',
      '1.2.3',
      '1.500',
      '1.501',
      '0.000',
      '99999999.9900',
    ];
    for (const v of grid) {
      expect(ok('money', v), v).toBe(numericFits(col, v));
    }
  });
});
