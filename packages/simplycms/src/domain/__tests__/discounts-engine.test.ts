// Рушій знижок: кейси легасі (`discounts.test.ts`), перенесені без зміни
// очікувань. Оператори — `discounts-engine-operators.test.ts`, дати й цілі —
// `-scope`, корені — `-roots`.
import { describe, expect, it } from 'vitest';
import { resolveDiscount } from '../discounts';
import { cond, ctx, disc, group } from './support/discount-fixtures';

const ids = (list: { id: string }[]) => list.map((entry) => entry.id);

describe('resolveDiscount — перенесені кейси легасі', () => {
  it('застосовує просту відсоткову знижку', () => {
    const res = resolveDiscount(100, [group({ discounts: [disc()] })], ctx());
    expect(res.totalDiscount).toBe(10);
    expect(res.finalPrice).toBe(90);
    expect(res.appliedDiscounts).toHaveLength(1);
  });

  // 🔴 Негативний контроль округлення до центів (фінальне рев'ю К2-Е0, B):
  // сума позиції мусить дорівнювати добутку показаної ціни на кількість.
  it('округлює до центів: 20.01 −50 % дає рівно 10.01, а не 10.005', () => {
    const forest = [group({ discounts: [disc({ discount_value: 50 })] })];
    const res = resolveDiscount(20.01, forest, ctx());
    expect(res.finalPrice).toBe(10.01);
    expect(res.totalDiscount).toBe(10);
    expect(res.finalPrice * 3).toBeCloseTo(30.03, 10);
  });

  it('AND сумує знижки', () => {
    const fixed = disc({
      id: 'b',
      discount_type: 'fixed_amount',
      discount_value: 5,
    });
    const forest = [group({ discounts: [disc({ id: 'a' }), fixed] })];
    expect(resolveDiscount(100, forest, ctx()).totalDiscount).toBe(15);
  });

  it('OR бере першу за пріоритетом, решту відхиляє', () => {
    const forest = [
      group({
        operator: 'or',
        discounts: [
          disc({ id: 'a', priority: 0, discount_value: 10 }),
          disc({ id: 'b', priority: 1, discount_value: 20 }),
        ],
      }),
    ];
    const res = resolveDiscount(100, forest, ctx());
    expect(res.totalDiscount).toBe(10);
    expect(ids(res.rejectedDiscounts)).toContain('b');
  });

  it('MAX бере найбільшу знижку', () => {
    const forest = [
      group({
        operator: 'max',
        discounts: [disc({ id: 'a' }), disc({ id: 'b', discount_value: 25 })],
      }),
    ];
    expect(resolveDiscount(100, forest, ctx()).totalDiscount).toBe(25);
  });

  it('fixed_price перемагає в групі AND', () => {
    const fp = disc({
      id: 'fp',
      discount_type: 'fixed_price',
      discount_value: 70,
    });
    const forest = [group({ discounts: [disc({ id: 'a' }), fp] })];
    const res = resolveDiscount(100, forest, ctx());
    expect(res.totalDiscount).toBe(30);
    expect(res.finalPrice).toBe(70);
    expect(ids(res.appliedDiscounts)).toEqual(['fp']);
  });

  it('відхиляє знижку, що не проходить min_order_amount', () => {
    const conditions = [cond('min_order_amount', '>=', 5000)];
    const forest = [group({ discounts: [disc({ conditions })] })];
    const res = resolveDiscount(100, forest, ctx());
    expect(res.totalDiscount).toBe(0);
    expect(res.rejectedDiscounts).toHaveLength(1);
  });

  it('обрізає загальну знижку базовою ціною', () => {
    const big = disc({ discount_type: 'fixed_amount', discount_value: 999 });
    const res = resolveDiscount(100, [group({ discounts: [big] })], ctx());
    expect(res.totalDiscount).toBe(100);
    expect(res.finalPrice).toBe(0);
  });
});
