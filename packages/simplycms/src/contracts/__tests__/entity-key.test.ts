import { describe, expect, it } from 'vitest';
import { ENTITY, entityKey } from '../entities';

describe('entityKey: єдина форма ключів кешу', () => {
  const k = entityKey(ENTITY.orderStatuses);

  it('сегмент 0 — завжди імʼя таблиці', () => {
    expect(k.all()).toEqual(['order_statuses']);
  });

  it('усі похідні ключі розширюють базовий як ПРЕФІКС', () => {
    // 🔴 Це вимога коректності query-collection, не стиль: TanStack Query
    // знаходить записи колекції префіксним матчем, і ключ, що не
    // розширює базовий, лишає застарілі дані у кеші (спека, Додаток Б-2).
    const base = k.all();
    for (const derived of [
      k.list(),
      k.detail('abc'),
      k.scoped('section', 'x'),
    ]) {
      expect(derived.slice(0, base.length)).toEqual(base);
    }
  });

  it('форма кожного ключа стабільна', () => {
    expect(k.list()).toEqual(['order_statuses', 'list']);
    expect(k.detail('abc')).toEqual(['order_statuses', 'detail', 'abc']);
    expect(k.scoped('section', 'x')).toEqual([
      'order_statuses',
      'section',
      'x',
    ]);
  });

  it('ENTITY не містить дублікатів значень', () => {
    const values = Object.values(ENTITY);
    expect(new Set(values).size).toBe(values.length);
  });
});
