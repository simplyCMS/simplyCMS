// Рушій знижок: оператори груп і чесний `applied` (Е6в-5) — переможець
// може бути дочірньою групою, програвші йдуть у `rejected`.
import { describe, expect, it } from 'vitest';
import { resolveDiscount } from '../discounts';
import { ctx, disc, group } from './support/discount-fixtures';

const ids = (list: { id: string }[]) => list.map((entry) => entry.id);

describe('resolveDiscount — оператори й чесний applied (Е6в-5)', () => {
  it('min → менша з двох, друга в rejected з lost_to_operator', () => {
    const forest = [
      group({
        operator: 'min',
        discounts: [
          disc({ id: 'a', discount_value: 10 }),
          disc({ id: 'b', discount_value: 20 }),
        ],
      }),
    ];
    const res = resolveDiscount(1000, forest, ctx());
    expect(res.finalPrice).toBe(900);
    expect(ids(res.appliedDiscounts)).toEqual(['a']);
    expect(res.rejectedDiscounts).toMatchObject([
      { id: 'b', reason: 'lost_to_operator' },
    ]);
  });

  it('not → finalPrice 1000, applied порожній', () => {
    const forest = [group({ operator: 'not', discounts: [disc({ id: 'a' })] })];
    const res = resolveDiscount(1000, forest, ctx());
    expect(res.finalPrice).toBe(1000);
    expect(res.appliedDiscounts).toEqual([]);
  });

  it('or: переможець — дочірня група з двома знижками, обидві в applied', () => {
    const child = group({
      id: 'child',
      name: 'Child',
      priority: 0,
      discounts: [
        disc({ id: 'c1', discount_value: 5 }),
        disc({ id: 'c2', discount_value: 7 }),
      ],
    });
    const forest = [
      group({
        operator: 'or',
        children: [child],
        discounts: [disc({ id: 'direct', priority: 1 })],
      }),
    ];
    const res = resolveDiscount(1000, forest, ctx());
    expect(res.finalPrice).toBe(880);
    expect(ids(res.appliedDiscounts)).toEqual(['c1', 'c2']);
    expect(res.rejectedDiscounts).toMatchObject([
      { id: 'direct', reason: 'lost_to_operator' },
    ]);
  });

  it('max з дочірньою групою-програвшою → жодна її знижка не в applied', () => {
    const child = group({
      id: 'child',
      discounts: [disc({ id: 'c1', discount_value: 5 })],
    });
    const forest = [
      group({
        operator: 'max',
        children: [child],
        discounts: [disc({ id: 'big', discount_value: 30 })],
      }),
    ];
    const res = resolveDiscount(1000, forest, ctx());
    expect(ids(res.appliedDiscounts)).toEqual(['big']);
    expect(res.rejectedDiscounts).toMatchObject([
      { id: 'c1', reason: 'lost_to_operator' },
    ]);
  });

  it('вкладеність на 3 рівні: max(or(and(5 %, 10 %)), 12 %) = 15 %', () => {
    const deep = group({
      id: 'l3',
      discounts: [disc({ id: 'x', discount_value: 5 }), disc({ id: 'y' })],
    });
    const mid = group({ id: 'l2', operator: 'or', children: [deep] });
    const forest = [
      group({
        id: 'l1',
        operator: 'max',
        children: [mid],
        discounts: [disc({ id: 'z', discount_value: 12 })],
      }),
    ];
    const res = resolveDiscount(1000, forest, ctx());
    expect(res.finalPrice).toBe(850);
    expect(ids(res.appliedDiscounts)).toEqual(['x', 'y']);
    expect(res.rejectedDiscounts).toMatchObject([
      { id: 'z', reason: 'lost_to_operator' },
    ]);
  });

  it('or: пряма знижка priority 100 програє дочірній групі priority 0', () => {
    const child = group({
      id: 'child',
      priority: 0,
      discounts: [disc({ id: 'c1', discount_value: 5 })],
    });
    const direct = disc({ id: 'direct', priority: 100, discount_value: 20 });
    const forest = [
      group({ operator: 'or', children: [child], discounts: [direct] }),
    ];
    expect(ids(resolveDiscount(1000, forest, ctx()).appliedDiscounts)).toEqual([
      'c1',
    ]);
  });

  it('or: при рівному пріоритеті пряма знижка перед групою', () => {
    const child = group({
      id: 'child',
      priority: 3,
      discounts: [disc({ id: 'c1', discount_value: 5 })],
    });
    const direct = disc({ id: 'direct', priority: 3, discount_value: 20 });
    const forest = [
      group({ operator: 'or', children: [child], discounts: [direct] }),
    ];
    expect(ids(resolveDiscount(1000, forest, ctx()).appliedDiscounts)).toEqual([
      'direct',
    ]);
  });
});
