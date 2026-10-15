import { describe, expect, it } from 'vitest';
import { AGGREGATE, ENTITY, collectionKey, entityKey } from '../entities';

describe('ключі вітрини містять мову (І36)', () => {
  const ID = 'p1';

  it('той самий id у двох мовах → різні ключі, [entity, locale, …]', () => {
    const en = entityKey(ENTITY.products, 'en').detail(ID);
    const uk = entityKey(ENTITY.products, 'uk').detail(ID);
    expect(en).toEqual(['products', 'en', 'detail', ID]);
    expect(uk).toEqual(['products', 'uk', 'detail', ID]);
    expect(en).not.toEqual(uk);
  });

  it('усі форми ключа несуть мову другим сегментом', () => {
    const k = entityKey(ENTITY.sections, 'en');
    expect(k.scoped('section', 'x')[1]).toBe('en');
    expect(k.variant('storefront')).toEqual([
      'sections',
      'en',
      'variant',
      'storefront',
    ]);
    expect(k.variant('filterable', 's1')).toEqual([
      'sections',
      'en',
      'variant',
      'filterable',
      's1',
    ]);
  });

  it('сегмент 0 і префікс-інвалідація незмінні: all() — [entity] для всіх мов', () => {
    const en = entityKey(ENTITY.products, 'en');
    expect(en.all()).toEqual(['products']);
    expect(en.detail(ID).slice(0, 1)).toEqual(en.all());
    expect(entityKey(ENTITY.products, 'uk').detail(ID).slice(0, 1)).toEqual(
      en.all(),
    );
  });

  it('без мови ключ лишається колишнім (адмінка, особисті дані)', () => {
    expect(entityKey(ENTITY.products).detail(ID)).toEqual([
      'products',
      'detail',
      ID,
    ]);
    expect(collectionKey(ENTITY.products)).toEqual(['products', 'list']);
  });

  it('агрегат: keyFor(locale) = [name, locale], префікс key зберігається', () => {
    const en = AGGREGATE.catalogProducts.keyFor('en');
    const uk = AGGREGATE.catalogProducts.keyFor('uk');
    expect(en).toEqual(['catalog-products', 'en']);
    expect(en).not.toEqual(uk);
    expect(en[0]).toBe(AGGREGATE.catalogProducts.key[0]);
  });
});
