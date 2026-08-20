import { describe, it, expect } from 'vitest';
import { resolveDiscount } from '../discounts';
import type { Discount, DiscountGroup, DiscountContext } from '../discounts';

function makeDiscount(over: Partial<Discount>): Discount {
  return {
    id: 'd1',
    name: 'D1',
    description: null,
    discount_type: 'percent',
    discount_value: 10,
    priority: 0,
    is_active: true,
    starts_at: null,
    ends_at: null,
    targets: [],
    conditions: [],
    ...over,
  };
}

function makeGroup(over: Partial<DiscountGroup>): DiscountGroup {
  return {
    id: 'g1',
    name: 'G1',
    description: null,
    operator: 'and',
    is_active: true,
    priority: 0,
    starts_at: null,
    ends_at: null,
    discounts: [],
    children: [],
    ...over,
  };
}

const baseCtx: DiscountContext = {
  quantity: 1,
  cartTotal: 1000,
  productId: 'p1',
  isLoggedIn: false,
};

describe('resolveDiscount', () => {
  it('applies a simple percent discount', () => {
    const groups = [
      makeGroup({ discounts: [makeDiscount({ discount_value: 10 })] }),
    ];
    const res = resolveDiscount(100, groups, baseCtx);
    expect(res.totalDiscount).toBe(10);
    expect(res.finalPrice).toBe(90);
    expect(res.appliedDiscounts).toHaveLength(1);
  });

  it('AND sums discounts', () => {
    const groups = [
      makeGroup({
        operator: 'and',
        discounts: [
          makeDiscount({ id: 'a', discount_value: 10 }),
          makeDiscount({
            id: 'b',
            discount_type: 'fixed_amount',
            discount_value: 5,
          }),
        ],
      }),
    ];
    const res = resolveDiscount(100, groups, baseCtx);
    expect(res.totalDiscount).toBe(15);
  });

  it('OR picks first by priority and rejects the rest', () => {
    const groups = [
      makeGroup({
        operator: 'or',
        discounts: [
          makeDiscount({ id: 'a', priority: 0, discount_value: 10 }),
          makeDiscount({ id: 'b', priority: 1, discount_value: 20 }),
        ],
      }),
    ];
    const res = resolveDiscount(100, groups, baseCtx);
    expect(res.totalDiscount).toBe(10);
    expect(res.rejectedDiscounts.map((r) => r.id)).toContain('b');
  });

  it('MAX picks the largest discount', () => {
    const groups = [
      makeGroup({
        operator: 'max',
        discounts: [
          makeDiscount({ id: 'a', discount_value: 10 }),
          makeDiscount({ id: 'b', discount_value: 25 }),
        ],
      }),
    ];
    const res = resolveDiscount(100, groups, baseCtx);
    expect(res.totalDiscount).toBe(25);
  });

  it('fixed_price wins in AND group', () => {
    const groups = [
      makeGroup({
        operator: 'and',
        discounts: [
          makeDiscount({ id: 'a', discount_value: 10 }),
          makeDiscount({
            id: 'fp',
            discount_type: 'fixed_price',
            discount_value: 70,
          }),
        ],
      }),
    ];
    const res = resolveDiscount(100, groups, baseCtx);
    // fixed_price -> amount = base - 70 = 30
    expect(res.totalDiscount).toBe(30);
    expect(res.finalPrice).toBe(70);
  });

  it('rejects discount failing min_order_amount condition', () => {
    const groups = [
      makeGroup({
        discounts: [
          makeDiscount({
            conditions: [
              {
                id: 'c',
                condition_type: 'min_order_amount',
                operator: '>=',
                value: 5000,
              },
            ],
          }),
        ],
      }),
    ];
    const res = resolveDiscount(100, groups, baseCtx);
    expect(res.totalDiscount).toBe(0);
    expect(res.rejectedDiscounts).toHaveLength(1);
  });

  it('clamps total discount to base price', () => {
    const groups = [
      makeGroup({
        discounts: [
          makeDiscount({ discount_type: 'fixed_amount', discount_value: 999 }),
        ],
      }),
    ];
    const res = resolveDiscount(100, groups, baseCtx);
    expect(res.totalDiscount).toBe(100);
    expect(res.finalPrice).toBe(0);
  });
});
