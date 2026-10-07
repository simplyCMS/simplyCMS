// Порогові підказки (Е6в-12): той самий рушій на гіпотетичному порозі.
import { describe, expect, it } from 'vitest';
import type { Discount, DiscountGroup } from 'simplycms/contracts';
import { discountThresholdHints, resolveDiscount } from '../discounts';
import {
  cond,
  ctx,
  disc,
  group,
  type CtxOverrides,
} from './support/discount-fixtures';

const fromQty = (n: number, over: Partial<Discount> = {}, operator = '>=') =>
  disc({
    id: `q${n}`,
    conditions: [cond('min_quantity', operator, n)],
    ...over,
  });
const hints = (forest: DiscountGroup[], over: CtxOverrides = {}) =>
  discountThresholdHints(1000, forest, ctx(over));

describe('discountThresholdHints', () => {
  it('min_quantity >= 3 −10 % при кількості 1', () => {
    expect(hints([group({ discounts: [fromQty(3)] })])).toEqual([
      { kind: 'quantity', threshold: 3, finalPrice: 900, percentOff: 10 },
    ]);
  });

  it('при кількості 3 підказки немає', () => {
    expect(
      hints([group({ discounts: [fromQty(3)] })], { quantity: 3 }),
    ).toEqual([]);
  });

  it('min_order_amount >= 2000 −5 %', () => {
    const d = disc({
      discount_value: 5,
      conditions: [cond('min_order_amount', '>=', 2000)],
    });
    expect(hints([group({ discounts: [d] })])).toEqual([
      { kind: 'cart_total', threshold: 2000, finalPrice: 950, percentOff: 5 },
    ]);
  });

  it('fixed_amount 50 від 3 шт → finalPrice 950, percentOff null', () => {
    const d = fromQty(3, { discount_type: 'fixed_amount', discount_value: 50 });
    expect(hints([group({ discounts: [d] })])).toEqual([
      { kind: 'quantity', threshold: 3, finalPrice: 950, percentOff: null },
    ]);
  });

  it('min_quantity > 2 → поріг 3', () => {
    expect(hints([group({ discounts: [fromQty(2, {}, '>')] })])).toMatchObject([
      { threshold: 3 },
    ]);
  });

  it('оператор <= → []', () => {
    expect(hints([group({ discounts: [fromQty(3, {}, '<=')] })])).toEqual([]);
  });

  it('поріг 5 дешевший за поріг 3 → обидва', () => {
    const forest = [
      group({ discounts: [fromQty(3), fromQty(5, { discount_value: 20 })] }),
    ];
    expect(hints(forest).map((h) => [h.threshold, h.finalPrice])).toEqual([
      [3, 900],
      [5, 700],
    ]);
  });

  it('поріг 5 не дешевший → лише 3', () => {
    const forest = [
      group({
        operator: 'or',
        discounts: [
          fromQty(3, { priority: 0 }),
          fromQty(5, { priority: 1, discount_value: 5 }),
        ],
      }),
    ];
    expect(hints(forest).map((h) => h.threshold)).toEqual([3]);
  });

  it('рядок 1 × 1000 при сумі кошика 5000: and(qty >= 3, сума >= 6000) → поріг 3', () => {
    const d = disc({
      conditions: [
        cond('min_quantity', '>=', 3),
        cond('min_order_amount', '>=', 6000),
      ],
    });
    // На порозі 3 шт сума кошика = 4000 інших товарів + 3 × 1000 = 7000.
    expect(hints([group({ discounts: [d] })], { total: 5000 })).toEqual([
      { kind: 'quantity', threshold: 3, finalPrice: 900, percentOff: 10 },
    ]);
  });

  it('картка (сума кошика 0): рядок сам дає суму порогу — 3 × 1000 ≥ 3000', () => {
    const d = disc({
      conditions: [
        cond('min_quantity', '>=', 3),
        cond('min_order_amount', '>=', 3000),
      ],
    });
    expect(hints([group({ discounts: [d] })], { total: 0 })).toMatchObject([
      { kind: 'quantity', threshold: 3, finalPrice: 900 },
    ]);
  });

  it('група max з «від 3 шт −10 %» і «від 3 шт −50 ₴» → ціна рушія на 3 шт', () => {
    const forest = [
      group({
        operator: 'max',
        discounts: [
          fromQty(3, { id: 'pct' }),
          fromQty(3, {
            id: 'uah',
            discount_type: 'fixed_amount',
            discount_value: 50,
          }),
        ],
      }),
    ];
    const atThree = resolveDiscount(
      1000,
      forest,
      ctx({ quantity: 3, total: 3000 }),
    );
    expect(atThree.finalPrice).toBe(900);
    expect(hints(forest)).toEqual([
      { kind: 'quantity', threshold: 3, finalPrice: 900, percentOff: 10 },
    ]);
  });

  it('ціль не збігається з товаром → підказки немає', () => {
    const d = fromQty(3, {
      targets: [{ id: 't', target_type: 'product', target_id: 'other' }],
    });
    expect(hints([group({ discounts: [d] })])).toEqual([]);
  });
});
