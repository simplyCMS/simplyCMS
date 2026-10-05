import { describe, expect, it } from 'vitest';
import { applySubset, type Filter } from './support/mutable-server';

/** Стаб сервера тримає wire-контракт subset (дзеркало subset-schema.ts). */
const T1 = new Date('2026-01-01T00:00:00Z');
const T2 = new Date('2026-02-01T00:00:00Z');
const rows = [
  { id: 'a', at: T1, n: 1 },
  { id: 'b', at: T2, n: 2 },
];
const run = (f: Partial<Filter> & Pick<Filter, 'operator' | 'value'>) =>
  applySubset(rows, { subset: { filters: [{ field: ['at'], ...f }] } });

describe('mutable-server: wire-контракт фільтрів', () => {
  it('gte з Date — дозволено', () => {
    expect(run({ operator: 'gte', value: T2 }).map((r) => r.id)).toEqual(['b']);
  });
  it('eq з Date — throw', () => {
    expect(() => run({ operator: 'eq', value: T1 })).toThrow(/поза контрактом/);
  });
  it('in з Date — throw', () => {
    expect(() => run({ operator: 'in', value: [T1] })).toThrow(
      /поза контрактом/,
    );
  });
  it('gte з NaN / Infinity / Invalid Date — throw', () => {
    for (const value of [NaN, Infinity, -Infinity, new Date('x')])
      expect(() => run({ operator: 'gte', value })).toThrow(/поза контрактом/);
  });
  it('eq з NaN — throw; скінченне число — ок', () => {
    expect(() => run({ operator: 'eq', value: NaN })).toThrow();
    expect(
      applySubset(rows, {
        subset: { filters: [{ field: ['n'], operator: 'eq', value: 2 }] },
      }).map((r) => r.id),
    ).toEqual(['b']);
  });
  it('in порожній / isNull не з null — throw', () => {
    expect(() => run({ operator: 'in', value: [] })).toThrow();
    expect(() => run({ operator: 'isNull', value: 1 })).toThrow();
  });
  it('невідомий оператор — throw', () => {
    expect(() => run({ operator: 'like', value: 'x' })).toThrow(
      /поза контрактом/,
    );
  });
});
