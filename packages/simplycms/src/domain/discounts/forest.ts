// Ліс знижок із плоских правил (Е6в-8) і лічильник піддерева для діалогу
// видалення групи.

import type { DiscountGroup } from 'simplycms/contracts';
import type { DiscountGroupRow, DiscountRules } from './types';

function toNode(row: DiscountGroupRow): DiscountGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    operator: row.operator,
    is_active: row.is_active,
    priority: row.priority,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    discounts: [],
    children: [],
  };
}

/**
 * Дерево знижок для типу ціни `priceTypeId`: знижки з цим типом або з
 * `price_type_id = NULL` («для всіх типів»).
 *
 * 🔴 Обхід іде ВІД КОРЕНІВ (`parent_group_id = NULL`):
 * - без `includeInactive` неактивна група падає РАЗОМ із піддеревом — її
 *   діти не піднімаються в корені (легасі `loadGroupClosure` піднімав, і
 *   вимкнений батько переставав стримувати акції дітей);
 * - група в циклі (A→B→A) недосяжна з коренів і до лісу не потрапляє, а
 *   решта лісу лишається цілою.
 * Дати не обрізаються: їх оцінює рушій із `now` розрахунку.
 * `includeInactive: true` — лише для діагностики ціни в адмінці.
 */
export function buildDiscountForest(
  rules: DiscountRules,
  priceTypeId: string | null,
  opts: { includeInactive: boolean },
): DiscountGroup[] {
  const childrenOf = new Map<string | null, DiscountGroupRow[]>();
  for (const row of rules.groups) {
    const siblings = childrenOf.get(row.parent_group_id) ?? [];
    siblings.push(row);
    childrenOf.set(row.parent_group_id, siblings);
  }

  const nodes = new Map<string, DiscountGroup>();
  const visit = (row: DiscountGroupRow): DiscountGroup[] => {
    if (nodes.has(row.id) || (!opts.includeInactive && !row.is_active))
      return [];
    const node = toNode(row);
    nodes.set(row.id, node);
    node.children = (childrenOf.get(row.id) ?? []).flatMap(visit);
    return [node];
  };
  const roots = (childrenOf.get(null) ?? []).flatMap(visit);

  for (const discount of rules.discounts) {
    const forType =
      discount.price_type_id === null || discount.price_type_id === priceTypeId;
    if (!forType || (!opts.includeInactive && !discount.is_active)) continue;
    nodes.get(discount.group_id)?.discounts.push(discount);
  }
  return roots;
}

/**
 * Скільки вкладених груп (без самої `groupId`) і знижок (з усього
 * піддерева) зникне разом із групою. Цикл у даних не зациклює підрахунок.
 */
export function countGroupSubtree(
  groupId: string,
  groups: readonly { id: string; parent_group_id: string | null }[],
  discounts: readonly { group_id: string }[],
): { groups: number; discounts: number } {
  const subtree = new Set([groupId]);
  let frontier = [groupId];
  while (frontier.length > 0) {
    const next = groups
      .filter(
        (g) =>
          g.parent_group_id !== null &&
          frontier.includes(g.parent_group_id) &&
          !subtree.has(g.id),
      )
      .map((g) => g.id);
    for (const id of next) subtree.add(id);
    frontier = next;
  }
  return {
    groups: subtree.size - 1,
    discounts: discounts.filter((d) => subtree.has(d.group_id)).length,
  };
}
