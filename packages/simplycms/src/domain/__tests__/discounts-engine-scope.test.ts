// Рушій знижок: активність і дати груп/знижок, цілі (Е6в-5, Е6в-7).
import { describe, expect, it } from 'vitest';
import type { DiscountTarget } from 'simplycms/contracts';
import { resolveDiscount } from '../discounts';
import { ctx, disc, group, NOW } from './support/discount-fixtures';

const target = (
  target_type: DiscountTarget['target_type'],
  target_id: string,
): DiscountTarget[] => [{ id: `t-${target_type}`, target_type, target_id }];
const DAY = 24 * 60 * 60 * 1000;

describe('resolveDiscount — активність і дати', () => {
  it('неактивна група → її знижки й знижки піддерева в rejected з group_inactive', () => {
    const child = group({ id: 'child', discounts: [disc({ id: 'c1' })] });
    const forest = [
      group({
        is_active: false,
        children: [child],
        discounts: [disc({ id: 'own' })],
      }),
    ];
    const res = resolveDiscount(1000, forest, ctx());
    expect(res.finalPrice).toBe(1000);
    expect(res.appliedDiscounts).toEqual([]);
    expect(res.rejectedDiscounts.map((r) => [r.id, r.reason]).sort()).toEqual([
      ['c1', 'group_inactive'],
      ['own', 'group_inactive'],
    ]);
  });

  it('група поза датами → group_out_of_dates', () => {
    const ended = new Date(NOW.getTime() - DAY);
    const forest = [group({ ends_at: ended, discounts: [disc({ id: 'a' })] })];
    const res = resolveDiscount(1000, forest, ctx());
    expect(res.rejectedDiscounts).toMatchObject([
      { id: 'a', reason: 'group_out_of_dates' },
    ]);
  });

  it('знижка до starts_at (now задано явно) → out_of_dates', () => {
    const starts = new Date(NOW.getTime() + DAY);
    const forest = [
      group({ discounts: [disc({ id: 'a', starts_at: starts })] }),
    ];
    const before = resolveDiscount(1000, forest, ctx());
    expect(before.rejectedDiscounts).toMatchObject([
      { id: 'a', reason: 'out_of_dates' },
    ]);
    const after = resolveDiscount(
      1000,
      forest,
      ctx({ now: new Date(starts.getTime() + 1) }),
    );
    expect(after.finalPrice).toBe(900);
  });
});

describe('resolveDiscount — цілі (Е6в-7)', () => {
  const priceWith = (targets: DiscountTarget[]) =>
    resolveDiscount(
      1000,
      [group({ discounts: [disc({ id: 'a', targets })] })],
      ctx({ modificationId: 'm1', sectionId: 's1' }),
    );

  it.each([
    ['product', 'p1', 900],
    ['product', 'p2', 1000],
    ['modification', 'm1', 900],
    ['modification', 'm2', 1000],
    ['section', 's1', 900],
    ['section', 's2', 1000],
  ] as const)('%s %s → %d', (type, id, price) => {
    expect(priceWith(target(type, id)).finalPrice).toBe(price);
  });

  it('незбіг цілі → target_mismatch', () => {
    expect(priceWith(target('product', 'p2')).rejectedDiscounts).toMatchObject([
      { id: 'a', reason: 'target_mismatch' },
    ]);
  });

  it('targets: [] → target_mismatch (fail-closed)', () => {
    const res = priceWith([]);
    expect(res.finalPrice).toBe(1000);
    expect(res.rejectedDiscounts).toMatchObject([
      { id: 'a', reason: 'target_mismatch', conditionType: null },
    ]);
  });
});
