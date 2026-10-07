// Будівники фікстур рушія знижок — спільні для чотирьох юніт-файлів.
//
// 🔴 Ціль за замовчуванням — явне `all`, а не порожній список: з Е6в-7
// порожні цілі означають `target_mismatch` (fail-closed), тож фікстура без
// цілі тихо перевіряла б відхилення замість застосування.

import type {
  Discount,
  DiscountCondition,
  DiscountContext,
  DiscountGroup,
  DiscountTarget,
  Json,
} from 'simplycms/contracts';
import type { DiscountGroupRow } from '../../discounts';

export const TARGET_ALL: DiscountTarget[] = [
  { id: 't-all', target_type: 'all', target_id: null },
];

export function disc(over: Partial<Discount> = {}): Discount {
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
    group_id: 'g1',
    price_type_id: null,
    targets: TARGET_ALL,
    conditions: [],
    ...over,
  };
}

export function group(over: Partial<DiscountGroup> = {}): DiscountGroup {
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

/** Плоский рядок групи — вхід `buildDiscountForest`. */
export function groupRow(
  id: string,
  parent: string | null,
  over: Partial<DiscountGroupRow> = {},
): DiscountGroupRow {
  const g = group({ id, name: id });
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    operator: g.operator,
    is_active: g.is_active,
    priority: g.priority,
    starts_at: g.starts_at,
    ends_at: g.ends_at,
    parent_group_id: parent,
    ...over,
  };
}

export function cond(
  condition_type: string,
  operator: string,
  value: Json,
): DiscountCondition {
  return { id: `c-${condition_type}`, condition_type, operator, value };
}

export interface CtxOverrides {
  quantity?: number;
  total?: number;
  categoryId?: string | null;
  isLoggedIn?: boolean;
  productId?: string;
  modificationId?: string | null;
  sectionId?: string | null;
  now?: Date;
}

export const NOW = new Date('2026-10-07T12:00:00Z');

export function ctx(over: CtxOverrides = {}): DiscountContext {
  return {
    customer: {
      categoryId: over.categoryId ?? null,
      isLoggedIn: over.isLoggedIn ?? false,
    },
    item: {
      productId: over.productId ?? 'p1',
      modificationId: over.modificationId ?? null,
      sectionId: over.sectionId ?? null,
      quantity: over.quantity ?? 1,
    },
    cart: { total: over.total ?? 1000 },
    now: over.now ?? NOW,
  };
}
