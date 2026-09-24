import { describe, expect, it } from 'vitest';
import { collectionKey, ENTITY, entityKey } from '../entities';

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
      collectionKey(ENTITY.orderStatuses),
      k.detail('abc'),
      k.scoped('section', 'x'),
    ]) {
      expect(derived.slice(0, base.length)).toEqual(base);
    }
  });

  it('форма кожного ключа стабільна', () => {
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

  describe('collectionKey: ЄДИНИЙ легальний ужиток сегмента "list" (Е3-15′)', () => {
    it('форма — [entity, "list"], та сама, що колишній entityKey(x).list()', () => {
      expect(collectionKey(ENTITY.orderStatuses)).toEqual([
        'order_statuses',
        'list',
      ]);
    });

    it('сегмент 0 — той самий, що в all()', () => {
      expect(collectionKey(ENTITY.orderStatuses)[0]).toBe(k.all()[0]);
    });
  });

  describe('variant: скоуп форми, не FK-зріз (Е3-15)', () => {
    it('без id — не збігається з collectionKey (колекція admin-data)', () => {
      expect(k.variant('storefront')).not.toEqual(
        collectionKey(ENTITY.orderStatuses),
      );
      expect(k.variant('storefront')).toEqual([
        'order_statuses',
        'variant',
        'storefront',
      ]);
    });

    it('з id — не збігається з scoped() тим самим qualifier/id (FK-relation)', () => {
      const numeric = entityKey(ENTITY.sectionProperties);
      expect(numeric.variant('numeric', 's1')).not.toEqual(
        numeric.scoped('numeric', 's1'),
      );
      expect(numeric.variant('numeric', 's1')).toEqual([
        'section_properties',
        'variant',
        'numeric',
        's1',
      ]);
    });

    it('сегмент 0 — той самий, що в all()', () => {
      expect(k.variant('storefront')[0]).toBe(k.all()[0]);
    });
  });
});
