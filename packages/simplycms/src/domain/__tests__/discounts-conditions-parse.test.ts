// Реєстр умов знижок (Е6в-4): розбір значень і досяжність порогів
// `min_quantity` у межах кошика (ред.3, ред.4).
import { describe, expect, it } from 'vitest';
import type { Json } from 'simplycms/contracts';
import {
  discountThresholdHints,
  getDiscountCondition,
  parseDiscountCondition,
  resolveDiscount,
} from '../discounts';
import { cond, ctx, disc, group } from './support/discount-fixtures';

/** Ціна 1000 з однією знижкою −10 % і однією умовою. */
const priceWith = (type: string, operator: string, value: Json, quantity = 1) =>
  resolveDiscount(
    1000,
    [
      group({
        discounts: [disc({ conditions: [cond(type, operator, value)] })],
      }),
    ],
    ctx({ quantity }),
  );

describe('розбір умов', () => {
  it('min_quantity "abc" → parse null, знижка не застосована', () => {
    expect(getDiscountCondition('min_quantity')?.parse('>=', 'abc')).toBeNull();
    expect(parseDiscountCondition('min_quantity', '>=', 'abc')).toBe(false);
    expect(priceWith('min_quantity', '>=', 'abc', 5).finalPrice).toBe(1000);
  });

  // Е6в-23: зареєстрований тип зі зламаним значенням — `condition_invalid`,
  // а не `condition_unknown` (той лише для незареєстрованого типу).
  it.each(['abc', 2.5, 1000] as const)(
    'min_quantity >= %s → condition_invalid',
    (value) => {
      const res = priceWith('min_quantity', '>=', value, 5);
      expect(res.finalPrice).toBe(1000);
      expect(res.rejectedDiscounts).toMatchObject([
        { reason: 'condition_invalid', conditionType: 'min_quantity' },
      ]);
    },
  );

  it.each([2.5, 1000, 0, -1])(
    'min_quantity >= %s → parse null (ціле 1…999)',
    (value) => {
      expect(
        getDiscountCondition('min_quantity')?.parse('>=', value),
      ).toBeNull();
    },
  );

  it('досяжність min_quantity: > 999 і < 1 невалідні, > 998 валідна', () => {
    const def = getDiscountCondition('min_quantity');
    expect(def?.parse('>', 999)).toBeNull();
    expect(def?.parse('<', 1)).toBeNull();
    expect(parseDiscountCondition('min_quantity', '>', 998)).toBe(true);
    expect(parseDiscountCondition('min_quantity', '<', 2)).toBe(true);
    expect(parseDiscountCondition('min_quantity', '!=', 3)).toBe(false);
  });

  it('> 998 дає підказку з порогом 999', () => {
    const forest = [
      group({
        discounts: [disc({ conditions: [cond('min_quantity', '>', 998)] })],
      }),
    ];
    expect(discountThresholdHints(1000, forest, ctx())).toMatchObject([
      { kind: 'quantity', threshold: 999, finalPrice: 900 },
    ]);
  });

  it('min_quantity > 2 дає підказку з порогом 3, що дорівнює ціні на 3 шт', () => {
    const forest = [
      group({
        discounts: [disc({ conditions: [cond('min_quantity', '>', 2)] })],
      }),
    ];
    const [hint] = discountThresholdHints(1000, forest, ctx());
    expect(hint).toMatchObject({ kind: 'quantity', threshold: 3 });
    expect(hint.finalPrice).toBe(
      resolveDiscount(1000, forest, ctx({ quantity: 3 })).finalPrice,
    );
  });

  it('невалідні значення інших умов → parse null', () => {
    expect(parseDiscountCondition('min_order_amount', '>=', -1)).toBe(false);
    expect(parseDiscountCondition('min_order_amount', '>=', '100')).toBe(false);
    expect(parseDiscountCondition('user_logged_in', '=', 'true')).toBe(false);
    expect(parseDiscountCondition('user_category', 'in', 'A')).toBe(false);
    expect(parseDiscountCondition('user_category', 'in', [])).toBe(false);
    expect(parseDiscountCondition('user_category', 'in', ['A'])).toBe(true);
  });
});
