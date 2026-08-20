import { describe, it, expect } from 'vitest';
import {
  CART_REQUISITES,
  CATALOG_REQUISITES,
  HOME_REQUISITES,
  PRODUCT_DETAIL_REQUISITES,
  REQUIRED_REQUISITES,
  REQUISITE_ATTRIBUTE,
} from '../views/requisites';

/**
 * Контракт імен реквізитів (Фаза 2). Парність «імʼя ↔ слот у view-model»
 * тримає `satisfies Record<keyof …Slots, string>` у самому файлі, тобто
 * `pnpm typecheck`; рантайм-тест доводить те, чого тип не бачить: імена
 * унікальні по всій вітрині (інакше conformance зарахував би чужий маркер)
 * і кожна сторінка має непорожній обовʼязковий склад.
 */
describe('імена комерційних реквізитів', () => {
  const all = [
    ...Object.values(HOME_REQUISITES),
    ...Object.values(CATALOG_REQUISITES),
    ...Object.values(PRODUCT_DETAIL_REQUISITES),
    ...Object.values(CART_REQUISITES),
  ];

  it('маркер — атрибут, а не клас', () => {
    expect(REQUISITE_ATTRIBUTE).toBe('data-simplycms-requisite');
  });

  it('усі імена унікальні', () => {
    expect(new Set(all).size).toBe(all.length);
  });

  it('імʼя має форму "<сторінка>.<реквізит>" у kebab-case', () => {
    for (const name of all) {
      expect(name, name).toMatch(/^[a-z-]+\.[a-z-]+$/);
    }
  });

  it('обовʼязковий склад описано для пʼяти сторінок', () => {
    const pages = Object.keys(REQUIRED_REQUISITES);
    expect(pages).toEqual([
      'Home',
      'Catalog',
      'CatalogSection',
      'ProductDetail',
      'Cart',
    ]);
    for (const [page, names] of Object.entries(REQUIRED_REQUISITES)) {
      for (const name of names) expect(all, `${page}: ${name}`).toContain(name);
    }
  });

  it('Home без обовʼязкових реквізитів (спека §5) — SectionCarousel 0..N разів', () => {
    expect(REQUIRED_REQUISITES.Home).toEqual([]);
  });

  it('решта сторінок мають непорожній обовʼязковий склад', () => {
    for (const page of [
      'Catalog',
      'CatalogSection',
      'ProductDetail',
      'Cart',
    ] as const) {
      expect(REQUIRED_REQUISITES[page].length, page).toBeGreaterThan(0);
    }
  });

  it('Cart: ClearCart — не обовʼязковий реквізит (спека §5, зручність, не ядро)', () => {
    expect(REQUIRED_REQUISITES.Cart).not.toContain(CART_REQUISITES.ClearCart);
    expect(REQUIRED_REQUISITES.Cart).toEqual([
      CART_REQUISITES.Items,
      CART_REQUISITES.Summary,
      CART_REQUISITES.Checkout,
    ]);
  });
});
