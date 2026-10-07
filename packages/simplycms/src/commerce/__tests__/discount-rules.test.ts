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

  describe('🔴 порядковий fail-closed (Е6в-25): розбір ніколи не кидає', () => {
    const spy = () => vi.spyOn(console, 'error').mockImplementation(() => {});

    it.each(['abc', 'NaN'])(
      'discount_value %s → знижку виключено, решта на місці, invalid каже хто',
      (bad) => {
        const log = spy();
        const rules = parseDiscountRules({
          groups: [GROUP],
          discounts: [
            { ...DISCOUNT, id: 'bad', name: 'Погана', discount_value: bad },
            DISCOUNT,
          ],
        });
        expect(rules.discounts.map((d) => d.id)).toEqual(['d1']);
        expect(rules.invalid).toEqual([
          { id: 'bad', name: 'Погана', groupName: 'Група', kind: 'discount' },
        ]);
        expect(log).toHaveBeenCalledTimes(1);
        expect(String(log.mock.calls[0][0])).toContain('[simplycms/commerce]');
        expect(String(log.mock.calls[0][0])).toContain('bad');
        log.mockRestore();
      },
    );

    it('група з роком 10000 (форма Postgres) виключена, її знижки недосяжні', () => {
      const log = spy();
      const rules = parseDiscountRules({
        groups: [
          {
            ...GROUP,
            id: 'g2',
            name: 'Погана',
            starts_at: '10000-01-01T00:00:00+00:00',
          },
        ],
        discounts: [{ ...DISCOUNT, group_id: 'g2' }],
      });
      expect(rules.groups).toEqual([]);
      expect(rules.invalid).toMatchObject([{ id: 'g2', kind: 'group' }]);
      expect(log).toHaveBeenCalled();
      log.mockRestore();
    });

    it('невідомі тип знижки, оператор групи, ціль — виключено', () => {
      const log = spy();
      const rules = parseDiscountRules({
        groups: [GROUP, { ...GROUP, id: 'g3', operator: 'xor' }],
        discounts: [
          { ...DISCOUNT, id: 'a', discount_type: 'bogus' },
          {
            ...DISCOUNT,
            id: 'b',
            targets: [{ id: 't', target_type: 'x', target_id: null }],
          },
          { ...DISCOUNT, id: 'c', starts_at: 'вчора' },
        ],
      });
      expect(rules.groups.map((g) => g.id)).toEqual(['g1']);
      expect(rules.discounts).toEqual([]);
      expect(rules.invalid.map((r) => r.id).sort()).toEqual([
        'a',
        'b',
        'c',
        'g3',
      ]);
      expect(log).toHaveBeenCalledTimes(4);
      log.mockRestore();
    });

    it.each([null, {}, []])(
      '%j → порожні правила й журнал, без винятку',
      (v) => {
        const log = spy();
        expect(parseDiscountRules(v)).toEqual({
          groups: [],
          discounts: [],
          invalid: [],
        });
        expect(log).toHaveBeenCalled();
        log.mockRestore();
      },
    );
  });

  it('цілі й умови переходять як є; група — рядок із parent_group_id', () => {
    const rules = parseDiscountRules(json());
    expect(rules.groups).toEqual([GROUP]);
    expect(rules.invalid).toEqual([]);
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
