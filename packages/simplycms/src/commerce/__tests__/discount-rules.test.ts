// Межа «БД → домен» правил знижок (Е6в-8): один SQL-вираз і одна функція
// розбору. Живий накат — харнес `discount-forest`/`price-cart`.
import { describe, expect, it, vi } from 'vitest';
import type { ActorDb } from 'simplycms/db';
import { loadDiscountRules, parseDiscountRules } from '../discount-rules';

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
  discount_value: '12.50',
  priority: 0,
  is_active: true,
  starts_at: '2026-03-29T00:30:00+00:00',
  ends_at: null,
  price_type_id: null,
  targets: [{ id: 't1', target_type: 'all', target_id: null }],
  conditions: [
    { id: 'c1', condition_type: 'min_quantity', operator: '>=', value: 3 },
  ],
};
const json = (discount: Record<string, unknown> = DISCOUNT) => ({
  groups: [GROUP],
  discounts: [discount],
});

describe('parseDiscountRules', () => {
  it('дата з рядка Postgres → Date з тим самим моментом', () => {
    const [d] = parseDiscountRules(json()).discounts;
    expect(d.starts_at).toBeInstanceOf(Date);
    expect(d.starts_at?.getTime()).toBe(
      new Date('2026-03-29T00:30:00Z').getTime(),
    );
    expect(d.ends_at).toBeNull();
  });

  it('numeric приходить рядком і розбирається явно: "12.50" → 12.5', () => {
    expect(parseDiscountRules(json()).discounts[0].discount_value).toBe(12.5);
  });

  it('невалідне число — виняток, а не тиха знижка', () => {
    expect(() =>
      parseDiscountRules(json({ ...DISCOUNT, discount_value: 'abc' })),
    ).toThrow(/discount_value/);
  });

  it('невалідна дата чи невідомий оператор групи — виняток', () => {
    expect(() =>
      parseDiscountRules(json({ ...DISCOUNT, starts_at: 'вчора' })),
    ).toThrow(/starts_at/);
    expect(() =>
      parseDiscountRules({
        groups: [{ ...GROUP, operator: 'xor' }],
        discounts: [],
      }),
    ).toThrow(/operator/);
  });

  it('цілі й умови переходять як є; група — рядок із parent_group_id', () => {
    const rules = parseDiscountRules(json());
    expect(rules.groups).toEqual([GROUP]);
    expect(rules.discounts[0].targets).toEqual(DISCOUNT.targets);
    expect(rules.discounts[0].conditions).toEqual(DISCOUNT.conditions);
  });
});

describe('loadDiscountRules', () => {
  it('🔴 рівно ОДИН виклик до db: один вираз — один знімок і в READ COMMITTED', async () => {
    const calls: string[] = [];
    // Будь-який метод db рахується викликом — і `execute`, і `select`.
    const db = new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === 'then') return undefined;
          return vi.fn(async () => {
            calls.push(String(prop));
            return { rows: [{ rules: json() }] };
          });
        },
      },
    ) as ActorDb;

    const rules = await loadDiscountRules(db);
    expect(calls).toEqual(['execute']);
    expect(rules.discounts[0].discount_value).toBe(12.5);
  });
});
