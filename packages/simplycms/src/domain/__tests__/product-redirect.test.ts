import { describe, expect, it } from 'vitest';
import { productRedirectTarget } from '../product-path';

describe('productRedirectTarget (Р25)', () => {
  it('товар з розділом, канонічний сегмент → без редіректу', () => {
    expect(
      productRedirectTarget({ slug: 'boot', sectionSlug: 'shoes' }, 'shoes'),
    ).toBeNull();
  });

  it('товар з розділом, чужий сегмент → 301 на розділ товару', () => {
    expect(
      productRedirectTarget({ slug: 'boot', sectionSlug: 'shoes' }, 'foo'),
    ).toEqual({
      to: '/catalog/$sectionSlug/$productSlug',
      params: { sectionSlug: 'shoes', productSlug: 'boot' },
    });
  });

  it('товар без розділу, сегмент `all` → без редіректу', () => {
    expect(
      productRedirectTarget({ slug: 'orphan', sectionSlug: null }, 'all'),
    ).toBeNull();
  });

  it('товар без розділу, сегмент `foo` → 301 на /catalog/all/<slug>', () => {
    expect(
      productRedirectTarget({ slug: 'orphan', sectionSlug: null }, 'foo'),
    ).toEqual({
      to: '/catalog/$sectionSlug/$productSlug',
      params: { sectionSlug: 'all', productSlug: 'orphan' },
    });
  });

  it('товар без розділу, порожній сегмент (старий /catalog//slug) → 301', () => {
    expect(
      productRedirectTarget({ slug: 'orphan', sectionSlug: null }, ''),
    ).not.toBeNull();
  });
});
