// Реєстр умов знижок (Е6в-4): розбір, оцінка, fail-closed.
import { describe, expect, it } from 'vitest';
import type { Json } from 'simplycms/contracts';
import {
  BUILT_IN_DISCOUNT_CONDITIONS,
  getDiscountCondition,
  parseDiscountCondition,
  resolveDiscount,
} from '../discounts';
import {
  cond,
  ctx,
  disc,
  group,
  type CtxOverrides,
} from './support/discount-fixtures';

/** Ціна 1000 з однією знижкою −10 % і однією умовою. */
const priceWith = (
  type: string,
  operator: string,
  value: Json,
  over: CtxOverrides = {},
) =>
  resolveDiscount(
    1000,
    [
      group({
        discounts: [
          disc({ id: 'a', conditions: [cond(type, operator, value)] }),
        ],
      }),
    ],
    ctx(over),
  );

describe('реєстр умов', () => {
  it('містить чотири вбудовані типи', () => {
    expect([...BUILT_IN_DISCOUNT_CONDITIONS]).toEqual([
      'user_category',
      'min_quantity',
      'min_order_amount',
      'user_logged_in',
    ]);
    for (const type of BUILT_IN_DISCOUNT_CONDITIONS)
      expect(getDiscountCondition(type)?.type).toBe(type);
    expect(getDiscountCondition('utm_campaign')).toBeUndefined();
  });

  it('user_category in [A]: A виконано, B ні', () => {
    expect(
      priceWith('user_category', 'in', ['A'], { categoryId: 'A' }).finalPrice,
    ).toBe(900);
    expect(
      priceWith('user_category', 'in', ['A'], { categoryId: 'B' }).finalPrice,
    ).toBe(1000);
  });

  it('user_category not_in [A]: B виконано, A ні', () => {
    expect(
      priceWith('user_category', 'not_in', ['A'], { categoryId: 'B' })
        .finalPrice,
    ).toBe(900);
    expect(
      priceWith('user_category', 'not_in', ['A'], { categoryId: 'A' })
        .finalPrice,
    ).toBe(1000);
  });

  it('min_quantity >= 3: кількість 3 виконано, 2 ні', () => {
    expect(priceWith('min_quantity', '>=', 3, { quantity: 3 }).finalPrice).toBe(
      900,
    );
    const res = priceWith('min_quantity', '>=', 3, { quantity: 2 });
    expect(res.finalPrice).toBe(1000);
    expect(res.rejectedDiscounts).toMatchObject([
      { reason: 'condition_failed', conditionType: 'min_quantity' },
    ]);
  });

  it('min_order_amount > 2000 при сумі 2000 → ні', () => {
    expect(
      priceWith('min_order_amount', '>', 2000, { total: 2000 }).finalPrice,
    ).toBe(1000);
    expect(
      priceWith('min_order_amount', '>', 2000, { total: 2000.01 }).finalPrice,
    ).toBe(900);
  });

  it('user_logged_in = true для гостя → ні', () => {
    expect(
      priceWith('user_logged_in', '=', true, { isLoggedIn: false }).finalPrice,
    ).toBe(1000);
    expect(
      priceWith('user_logged_in', '=', true, { isLoggedIn: true }).finalPrice,
    ).toBe(900);
  });

  it('невідомий тип utm_campaign → condition_unknown, знижка не застосована', () => {
    const res = priceWith('utm_campaign', '=', 'spring');
    expect(res.finalPrice).toBe(1000);
    expect(res.rejectedDiscounts).toMatchObject([
      { id: 'a', reason: 'condition_unknown', conditionType: 'utm_campaign' },
    ]);
    expect(parseDiscountCondition('utm_campaign', '=', 'spring')).toBe(false);
  });
});
