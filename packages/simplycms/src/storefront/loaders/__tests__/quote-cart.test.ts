import { describe, expect, it, vi } from 'vitest';
import { checkedTextLocale } from 'simplycms/domain/translations';

/**
 * Порожній кошик (Е6в-13): нульова квота без жодної транзакції. Ціни
 * непорожнього кошика доводить харнес (`price-cart.test.ts`) на живому
 * Postgres — тут лише межа «без звернення до БД».
 */
const db = vi.hoisted(() => ({
  withStorefrontDb: vi.fn(),
  withCustomerDb: vi.fn(),
}));
const commerce = vi.hoisted(() => ({
  loadPricingContext: vi.fn(),
  priceCart: vi.fn(),
}));
vi.mock('../db', () => db);
vi.mock('simplycms/commerce', () => commerce);

import { quoteCartFor } from '../quote-cart';

describe('quoteCartFor: порожній кошик', () => {
  it.each([null, 'u1'])(
    'userId %s — { lines: [], subtotal: 0 } без БД',
    async (userId) => {
      await expect(
        quoteCartFor([], userId, checkedTextLocale('uk', 'uk')),
      ).resolves.toEqual({
        lines: [],
        subtotal: 0,
      });
      expect(db.withStorefrontDb).not.toHaveBeenCalled();
      expect(db.withCustomerDb).not.toHaveBeenCalled();
      expect(commerce.loadPricingContext).not.toHaveBeenCalled();
    },
  );
});
