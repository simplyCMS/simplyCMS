// Ліс знижок (Е6в-8): дерево з плоских правил, фільтр типу ціни й
// активності, відсікання циклів; лічильник піддерева для діалогу видалення.
import { describe, expect, it } from 'vitest';
import type { DiscountGroup } from 'simplycms/contracts';
import {
  buildDiscountForest,
  countGroupSubtree,
  type DiscountRules,
} from '../discounts';
import { disc, groupRow as row } from './support/discount-fixtures';

/** Усі id груп лісу в порядку обходу в глибину. */
const groupIds = (forest: DiscountGroup[]): string[] =>
  forest.flatMap((node) => [node.id, ...groupIds(node.children)]);
const discountIds = (forest: DiscountGroup[]): string[] =>
  forest.flatMap((node) => [
    ...node.discounts.map((d) => d.id),
    ...discountIds(node.children),
  ]);

const ACTIVE = { includeInactive: false };

describe('buildDiscountForest', () => {
  it('будує дерево за parent_group_id', () => {
    const rules: DiscountRules = {
      groups: [row('root', null), row('child', 'root')],
      discounts: [disc({ id: 'a', group_id: 'child' })],
    };
    const [root] = buildDiscountForest(rules, 'T', ACTIVE);
    expect(root.id).toBe('root');
    expect(root.children.map((c) => c.id)).toEqual(['child']);
    expect(root.children[0].discounts.map((d) => d.id)).toEqual(['a']);
  });

  it('неактивний батько → дитина НЕ в корені і ніде', () => {
    const rules: DiscountRules = {
      groups: [
        row('off', null, { is_active: false }),
        row('child', 'off'),
        row('other', null),
      ],
      discounts: [
        disc({ id: 'a', group_id: 'child' }),
        disc({ id: 'b', group_id: 'other' }),
      ],
    };
    const forest = buildDiscountForest(rules, 'T', ACTIVE);
    expect(groupIds(forest)).toEqual(['other']);
    expect(discountIds(forest)).toEqual(['b']);
  });

  it('includeInactive: true → неактивна група на своєму місці', () => {
    const rules: DiscountRules = {
      groups: [row('root', null), row('off', 'root', { is_active: false })],
      discounts: [disc({ id: 'a', group_id: 'off', is_active: false })],
    };
    const [root] = buildDiscountForest(rules, 'T', { includeInactive: true });
    expect(root.children.map((c) => [c.id, c.is_active])).toEqual([
      ['off', false],
    ]);
    expect(root.children[0].discounts.map((d) => d.id)).toEqual(['a']);
  });

  it('без includeInactive неактивна знижка відкидається', () => {
    const rules: DiscountRules = {
      groups: [row('root', null)],
      discounts: [disc({ id: 'a', group_id: 'root', is_active: false })],
    };
    expect(discountIds(buildDiscountForest(rules, 'T', ACTIVE))).toEqual([]);
  });

  it('знижка з price_type_id NULL є для типу T, знижка типу U — немає', () => {
    const rules: DiscountRules = {
      groups: [row('root', null)],
      discounts: [
        disc({ id: 'any', group_id: 'root', price_type_id: null }),
        disc({ id: 'forT', group_id: 'root', price_type_id: 'T' }),
        disc({ id: 'forU', group_id: 'root', price_type_id: 'U' }),
      ],
    };
    expect(discountIds(buildDiscountForest(rules, 'T', ACTIVE))).toEqual([
      'any',
      'forT',
    ]);
  });

  it('цикл A→B→A → обидві відсутні, решта лісу ціла', () => {
    const rules: DiscountRules = {
      groups: [
        row('A', 'B'),
        row('B', 'A'),
        row('root', null),
        row('leaf', 'root'),
      ],
      discounts: [
        disc({ id: 'inCycle', group_id: 'A' }),
        disc({ id: 'ok', group_id: 'leaf' }),
      ],
    };
    const forest = buildDiscountForest(rules, 'T', ACTIVE);
    expect(groupIds(forest)).toEqual(['root', 'leaf']);
    expect(discountIds(forest)).toEqual(['ok']);
  });
});

describe('countGroupSubtree', () => {
  it('рахує вкладені групи й усі знижки піддерева', () => {
    const groups = [
      row('root', null),
      row('a', 'root'),
      row('b', 'a'),
      row('other', null),
    ];
    const discounts = [
      { group_id: 'root' },
      { group_id: 'b' },
      { group_id: 'b' },
      { group_id: 'other' },
    ];
    expect(countGroupSubtree('root', groups, discounts)).toEqual({
      groups: 2,
      discounts: 3,
    });
    expect(countGroupSubtree('b', groups, discounts)).toEqual({
      groups: 0,
      discounts: 2,
    });
  });

  it('цикл у даних не зациклює підрахунок', () => {
    const groups = [row('A', 'B'), row('B', 'A')];
    expect(countGroupSubtree('A', groups, [{ group_id: 'B' }])).toEqual({
      groups: 1,
      discounts: 1,
    });
  });
});
