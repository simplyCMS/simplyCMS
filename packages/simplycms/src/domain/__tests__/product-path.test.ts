import { describe, expect, it } from 'vitest';
import {
  NO_SECTION_SLUG,
  isReservedSectionSlug,
  productPath,
} from '../product-path';
import { SLUG_RE } from '../slug';

describe('productPath (К3-Е8, Р25)', () => {
  it('з розділом: /catalog/<розділ>/<slug>, to+params і href узгоджені', () => {
    const p = productPath({ slug: 'boot', sectionSlug: 'shoes' });
    expect(p.href).toBe('/catalog/shoes/boot');
    expect(p.params).toEqual({ sectionSlug: 'shoes', productSlug: 'boot' });
    expect(p.to).toBe('/catalog/$sectionSlug/$productSlug');
  });

  it.each([null, undefined, ''])(
    'без розділу (%j): зарезервований сегмент, ніколи порожній',
    (sectionSlug) => {
      const p = productPath({ slug: 'orphan', sectionSlug });
      expect(p.href).toBe('/catalog/all/orphan');
      expect(p.params.sectionSlug).toBe(NO_SECTION_SLUG);
      expect(p.href).not.toContain('//');
    },
  );

  it('зарезервований сегмент — валідний за SLUG_RE, тож його треба відхиляти окремо', () => {
    expect(SLUG_RE.test(NO_SECTION_SLUG)).toBe(true);
    expect(isReservedSectionSlug(NO_SECTION_SLUG)).toBe(true);
    expect(isReservedSectionSlug('shoes')).toBe(false);
  });
});
