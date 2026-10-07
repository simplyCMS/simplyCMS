// Рушій знижок: корені лісу із залишком, `exceeds_price` і центи
// (Е6в-5, Е6в-9).
import { describe, expect, it } from 'vitest';
import { resolveDiscount } from '../discounts';
import { toCents } from '../pricing';
import { cond, ctx, disc, group } from './support/discount-fixtures';

const ids = (list: { id: string }[]) => list.map((entry) => entry.id);

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
    const res = resolveDiscount(1000, forest, ctx());
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
    const res = resolveDiscount(1000, forest, ctx());
    expect(ids(res.appliedDiscounts)).toEqual(['full']);
    expect(res.rejectedDiscounts).toMatchObject([
      { id: 'ten', reason: 'exceeds_price' },
    ]);
    const sum = res.appliedDiscounts.reduce(
      (s, a) => s + toCents(a.calculatedAmount),
      0,
    );
    expect(sum).toBe(toCents(res.totalDiscount));
  });

  it('корені −700 і −500 при базі 1000 → calculatedAmount 700 і 300', () => {
    const fixed = (id: string, value: number) =>
      disc({ id, discount_type: 'fixed_amount', discount_value: value });
    const forest = [
      group({ id: 'r1', discounts: [fixed('a', 700)] }),
      group({ id: 'r2', priority: 1, discounts: [fixed('b', 500)] }),
    ];
    const res = resolveDiscount(1000, forest, ctx());
    expect(res.appliedDiscounts.map((a) => a.calculatedAmount)).toEqual([
      700, 300,
    ]);
    expect(res.totalDiscount).toBe(1000);
  });

  it('Σ calculatedAmount = totalDiscount у центах і при дробових відсотках', () => {
    const third = (id: string) => disc({ id, discount_value: 33.333 });
    const forest = [group({ discounts: [third('a'), third('b'), third('c')] })];
    const res = resolveDiscount(10.01, forest, ctx());
    const sum = res.appliedDiscounts.reduce(
      (s, a) => s + toCents(a.calculatedAmount),
      0,
    );
    expect(sum).toBe(toCents(res.totalDiscount));
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
