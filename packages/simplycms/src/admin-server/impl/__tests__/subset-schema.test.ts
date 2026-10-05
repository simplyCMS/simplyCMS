import { describe, expect, it } from 'vitest';
import { subsetInputSchema } from '../subset';

const parse = (operator: string, value: unknown) =>
  subsetInputSchema.safeParse({
    subset: { filters: [{ field: ['createdAt'], operator, value }] },
  }).success;
const d = new Date('2026-01-01T00:00:00.123Z');

describe('subsetInputSchema: форма value привʼязана до оператора', () => {
  it('isNull з непорожнім value — 400 на межі', () => {
    expect(parse('isNull', 1)).toBe(false);
  });

  it('R9: in/eq — скаляр чи масив за оператором (400, не 500 з БД)', () => {
    expect(parse('in', 'x')).toBe(false);
    expect(parse('in', [])).toBe(false);
    expect(parse('eq', ['a', 'b'])).toBe(false);
    expect(parse('in', ['a', 'b'])).toBe(true);
    expect(parse('eq', null)).toBe(true);
  });

  it('строгий: limit обмежений, сміття не проходить', () => {
    expect(
      subsetInputSchema.safeParse({ subset: { limit: 100_000 } }).success,
    ).toBe(false);
    expect(
      subsetInputSchema.safeParse({ subset: { filters: 'x' } }).success,
    ).toBe(false);
    expect(subsetInputSchema.safeParse({}).success).toBe(true);
    expect(
      subsetInputSchema.safeParse({
        subset: {
          filters: [{ field: ['code'], operator: 'eq', value: 'new' }],
          limit: 50,
        },
      }).success,
    ).toBe(true);
  });

  it('(г) Invalid Date, NaN, Infinity у діапазонних операторах — відхиляє', () => {
    for (const op of ['gt', 'gte', 'lt', 'lte']) {
      expect(parse(op, new Date(NaN))).toBe(false);
      expect(parse(op, Number.NaN)).toBe(false);
      expect(parse(op, Number.POSITIVE_INFINITY)).toBe(false);
      expect(parse(op, Number.NEGATIVE_INFINITY)).toBe(false);
      expect(parse(op, d)).toBe(true);
      expect(parse(op, 5)).toBe(true);
    }
  });

  it('(д) Date в eq/in/isNull — відхиляє', () => {
    expect(parse('eq', d)).toBe(false);
    expect(parse('in', [d])).toBe(false);
    expect(parse('isNull', d)).toBe(false);
  });
});
