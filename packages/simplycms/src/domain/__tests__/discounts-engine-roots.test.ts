// Рушій знижок: корені лісу із залишком, `exceeds_price` і центи
// (Е6в-5, Е6в-9).
import { describe, expect, it } from 'vitest';
import type { DiscountGroup, DiscountResult } from 'simplycms/contracts';
import { resolveDiscount } from '../discounts';
import { toCents } from '../pricing';
import { cond, ctx, disc, group } from './support/discount-fixtures';

const ids = (list: { id: string }[]) => list.map((entry) => entry.id);
const fixed = (id: string, value: number) =>
  disc({ id, discount_type: 'fixed_amount', discount_value: value });
/** Кожна знижка — окремим коренем, пріоритет за порядком. */
const roots = (...discounts: ReturnType<typeof disc>[]): DiscountGroup[] =>
  discounts.map((d, i) => group({ id: `r${i}`, priority: i, discounts: [d] }));

/** Інваріанти Е6в-5 у центах: вони тримають `discount_data` чесним. */
function resolveChecked(base: number, forest: DiscountGroup[]): DiscountResult {
  const res = resolveDiscount(base, forest, ctx());
  for (const a of res.appliedDiscounts)
    expect(a.calculatedAmount).toBeGreaterThan(0);
  const sum = res.appliedDiscounts.reduce(
    (s, a) => s + toCents(a.calculatedAmount),
    0,
  );
  expect(sum).toBe(toCents(res.totalDiscount));
  expect(toCents(base) - toCents(res.totalDiscount)).toBe(
    toCents(res.finalPrice),
  );
  return res;
}

describe('resolveDiscount — корені із залишком', () => {
  it('сума коренів обрізається базовою ціною', () => {
    const forest = [
      group({ id: 'r1', discounts: [disc({ id: 'a', discount_value: 60 })] }),
      group({
        id: 'r2',
        priority: 1,
        discounts: [disc({ id: 'b', discount_value: 70 })],
      }),
    ];
    const res = resolveChecked(1000, forest);
    expect(res.finalPrice).toBe(0);
    expect(res.totalDiscount).toBe(1000);
  });

  it('корені −100 % і −10 % → applied лише першої, друга exceeds_price', () => {
    const forest = [
      group({
        id: 'r1',
        discounts: [disc({ id: 'full', discount_value: 100 })],
      }),
      group({ id: 'r2', priority: 1, discounts: [disc({ id: 'ten' })] }),
    ];
    const res = resolveChecked(1000, forest);
    expect(ids(res.appliedDiscounts)).toEqual(['full']);
    expect(res.rejectedDiscounts).toMatchObject([
      { id: 'ten', reason: 'exceeds_price' },
    ]);
  });

  // 🔴 Пінує ПОКОРЕНЕВИЙ розподіл: без обрізання залишком друга знижка
  // лишилась би 500 (мутацію перевірено — тест червоніє).
  it('корені −700 і −500 при базі 1000 → calculatedAmount 700 і 300', () => {
    const res = resolveChecked(1000, roots(fixed('a', 700), fixed('b', 500)));
    expect(res.appliedDiscounts.map((a) => [a.id, a.calculatedAmount])).toEqual(
      [
        ['a', 700],
        ['b', 300],
      ],
    );
    expect(res.rejectedDiscounts).toEqual([]);
    expect(res.totalDiscount).toBe(1000);
  });

  it('база 10: 99.95 % і fixed 1 → друга exceeds_price, а не «0 застосовано»', () => {
    const res = resolveChecked(
      10,
      roots(disc({ id: 'a', discount_value: 99.95 }), fixed('b', 1)),
    );
    expect(res.finalPrice).toBe(0);
    expect(res.appliedDiscounts.map((a) => [a.id, a.calculatedAmount])).toEqual(
      [['a', 10]],
    );
    expect(res.rejectedDiscounts).toMatchObject([
      { id: 'b', reason: 'exceeds_price' },
    ]);
  });

  it('база 0.04: 37.5 % + 37.5 % + 12.5 % → без відʼємних сум', () => {
    const pct = (id: string, value: number) =>
      disc({ id, discount_value: value });
    const res = resolveChecked(
      0.04,
      roots(pct('a', 37.5), pct('b', 37.5), pct('c', 12.5)),
    );
    expect(res.finalPrice).toBe(0.01);
    expect(res.appliedDiscounts.map((a) => [a.id, a.calculatedAmount])).toEqual(
      [
        ['a', 0.01],
        ['b', 0.02],
      ],
    );
    expect(res.rejectedDiscounts).toMatchObject([
      { id: 'c', reason: 'exceeds_price' },
    ]);
  });

  it('знижка з власною сумою 0 (fixed_price ≥ бази) → exceeds_price', () => {
    const fp = disc({
      id: 'fp',
      discount_type: 'fixed_price',
      discount_value: 1200,
    });
    const res = resolveChecked(1000, roots(fp));
    expect(res.appliedDiscounts).toEqual([]);
    expect(res.rejectedDiscounts).toMatchObject([
      { id: 'fp', reason: 'exceeds_price' },
    ]);
  });

  it('Σ calculatedAmount = totalDiscount у центах і при дробових відсотках', () => {
    const third = (id: string) => disc({ id, discount_value: 33.333 });
    const forest = [group({ discounts: [third('a'), third('b'), third('c')] })];
    expect(resolveChecked(10.01, forest).totalDiscount).toBe(10.01);
  });

  it('min_order_amount > 0.3 при сумі 0.1 + 0.2 → НЕ виконано', () => {
    const forest = [
      group({
        discounts: [
          disc({ id: 'a', conditions: [cond('min_order_amount', '>', 0.3)] }),
        ],
      }),
    ];
    const res = resolveDiscount(1000, forest, ctx({ total: 0.1 + 0.2 }));
    expect(res.finalPrice).toBe(1000);
    expect(res.rejectedDiscounts).toMatchObject([
      {
        id: 'a',
        reason: 'condition_failed',
        conditionType: 'min_order_amount',
      },
    ]);
  });
});
