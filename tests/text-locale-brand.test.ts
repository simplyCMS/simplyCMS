import { describe, expect, expectTypeOf, it } from 'vitest';
import { priceCart, priceItems } from 'simplycms/commerce';
import { loadCatalog } from '../packages/simplycms/src/commerce/price-cart-catalog';
import {
  checkedTextLocale,
  type TextLocale,
} from 'simplycms/domain/translations';

/**
 * М1 Task 16 (m6): `TextLocale` — брендований тип. Літерал `{ locale, primary }` не
 * компілюється; значення виробляють лише межі (`resolveTextLocale`, `requirePublishedTextLocale`,
 * адмін-читачі) через `checkedTextLocale`. Доказ — typecheck: зайвий `@ts-expect-error` теж падає.
 */
describe('TextLocale: бренд «мову перевірено»', () => {
  it('літерал не є TextLocale', () => {
    // @ts-expect-error — без бренду `__checked` літерал не приймається
    const literal: TextLocale = { locale: 'en', primary: 'uk' };
    expect(literal.locale).toBe('en');
  });

  it('loadCatalog / priceCart / priceItems беруть лише брендований TextLocale', () => {
    expectTypeOf<
      Parameters<typeof loadCatalog>[3]
    >().toEqualTypeOf<TextLocale>();
    expectTypeOf<Parameters<typeof priceCart>[3]>().toEqualTypeOf<TextLocale>();
    expectTypeOf<
      Parameters<typeof priceItems>[3]
    >().toEqualTypeOf<TextLocale>();
  });

  it('checkedTextLocale повертає пару без зайвих рантайм-полів', () => {
    expect(checkedTextLocale('en', 'uk')).toEqual({
      locale: 'en',
      primary: 'uk',
    });
  });
});
