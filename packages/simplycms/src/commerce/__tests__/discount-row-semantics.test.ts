// Е6в-25, друга лінія: рядок знижки, СИНТАКСИЧНО валідний, але семантично
// неможливий для запису через `saveDiscount` (вставлений SQL-ем в обхід
// Zod), виключається порядково — так само, як рік 10000 чи `'NaN'`.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseDiscountRules } from '../discount-rules';

const GROUP = {
  id: 'g1',
  name: 'Група',
  description: null,
  operator: 'and',
  is_active: true,
  priority: 0,
  starts_at: null,
  ends_at: null,
  parent_group_id: null,
};
const DISCOUNT = {
  id: 'd1',
  group_id: 'g1',
  name: 'Знижка',
  description: null,
  discount_type: 'percent',
  discount_value: '10',
  priority: 0,
  is_active: true,
  starts_at: null,
  ends_at: null,
  price_type_id: null,
  targets: [{ id: 't1', target_type: 'all', target_id: null }],
  conditions: [],
};

const bad = (patch: Record<string, unknown>) =>
  parseDiscountRules({
    groups: [GROUP],
    discounts: [{ ...DISCOUNT, id: 'bad', name: 'Погана', ...patch }, DISCOUNT],
  });

afterEach(() => vi.restoreAllMocks());

describe('parseDiscountRules: семантика рядка (Е6в-25, друга лінія)', () => {
  const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

  it.each([
    ['product', null],
    ['modification', null],
    ['section', null],
    ['all', 'p1'],
  ])('ціль %s з target_id = %s → знижку виключено, решта діє', (type, id) => {
    quiet();
    const rules = bad({
      targets: [{ id: 't9', target_type: type, target_id: id }],
    });
    expect(rules.discounts.map((d) => d.id)).toEqual(['d1']);
    expect(rules.invalid).toEqual([
      { id: 'bad', name: 'Погана', groupName: 'Група', kind: 'discount' },
    ]);
  });

  it.each([
    ['percent', '150'],
    ['percent', '0'],
    ['fixed_amount', '-50'],
    ['fixed_amount', '0'],
    ['fixed_price', '-1'],
  ])('%s зі значенням %s → знижку виключено', (type, value) => {
    quiet();
    const rules = bad({ discount_type: type, discount_value: value });
    expect(rules.discounts.map((d) => d.id)).toEqual(['d1']);
    expect(rules.invalid.map((r) => r.id)).toEqual(['bad']);
  });

  it('межі допустимого: percent 100, fixed_amount 0.01, ціль product з id — у лісі', () => {
    const rules = parseDiscountRules({
      groups: [GROUP],
      discounts: [
        { ...DISCOUNT, id: 'p100', discount_value: '100' },
        {
          ...DISCOUNT,
          id: 'fa',
          discount_type: 'fixed_amount',
          discount_value: '0.01',
          targets: [{ id: 't2', target_type: 'product', target_id: 'p1' }],
        },
      ],
    });
    expect(rules.discounts.map((d) => d.id)).toEqual(['p100', 'fa']);
    expect(rules.invalid).toEqual([]);
  });
});
