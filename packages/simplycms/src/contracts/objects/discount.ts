// Доменні типи системи знижок. Винесено з core/lib/discountEngine,
// відв'язано від Database (Json — локальний тип).

import type { Json } from './common';

export type DiscountType = 'percent' | 'fixed_amount' | 'fixed_price';
export type GroupOperator = 'and' | 'or' | 'not' | 'min' | 'max';
export type TargetType = 'product' | 'modification' | 'section' | 'all';

export interface DiscountTarget {
  id: string;
  target_type: TargetType;
  target_id: string | null;
}

export interface DiscountCondition {
  id: string;
  condition_type: string;
  operator: string;
  value: Json;
}

export interface Discount {
  id: string;
  /** Група-власник: за нею `buildDiscountForest` чіпляє знижку в дерево. */
  group_id: string;
  name: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  priority: number;
  is_active: boolean;
  starts_at: Date | null;
  ends_at: Date | null;
  /** `null` — знижка для всіх типів цін (Е6в-2). */
  price_type_id: string | null;
  targets: DiscountTarget[];
  conditions: DiscountCondition[];
}

export interface DiscountGroup {
  id: string;
  name: string;
  description: string | null;
  operator: GroupOperator;
  is_active: boolean;
  priority: number;
  starts_at: Date | null;
  ends_at: Date | null;
  discounts: Discount[];
  children: DiscountGroup[];
}

/**
 * Вхід рушія знижок (Е6в-3) — контракт умов, який у К5 відкриється плагінам.
 *
 * 🔴 `now` обовʼязковий і без відкату на `new Date()`: картка, кошик і чек
 * мусять рахувати на ОДНОМУ серверному часі, інакше межа акції в секунду
 * оформлення дає різні ціни на екрані й у замовленні.
 */
export interface DiscountContext {
  customer: { categoryId: string | null; isLoggedIn: boolean };
  item: {
    productId: string;
    modificationId: string | null;
    sectionId: string | null;
    quantity: number;
  };
  /** Сума БАЗОВИХ цін кошика (Е6в-9). */
  cart: { total: number };
  now: Date;
}

export interface AppliedDiscount {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  calculatedAmount: number;
  groupName: string;
}

/**
 * Чому знижка не увійшла в суму (Е6в-6). Код, а не текст: пояснення
 * перекладає адмінка (i18n), домен мови не знає.
 */
export type DiscountRejectionReason =
  | 'inactive'
  | 'out_of_dates'
  | 'group_inactive'
  | 'group_out_of_dates'
  | 'target_mismatch'
  | 'condition_failed'
  | 'condition_unknown'
  | 'lost_to_operator'
  | 'exceeds_price';

export interface RejectedDiscount {
  id: string;
  name: string;
  groupName: string;
  reason: DiscountRejectionReason;
  /** Тип умови для `condition_failed`/`condition_unknown`, інакше `null`. */
  conditionType: string | null;
}

export interface DiscountResult {
  finalPrice: number;
  totalDiscount: number;
  appliedDiscounts: AppliedDiscount[];
  rejectedDiscounts: RejectedDiscount[];
}

/**
 * Порогова підказка (Е6в-12): «від 3 шт — 900 ₴/шт». Головне — ціна;
 * `percentOff` є лише тоді, коли на порозі застосовано рівно одну знижку
 * типу `percent`, бо −50 ₴, переведені у відсоток, вводять в оману.
 */
export interface ThresholdHint {
  kind: 'quantity' | 'cart_total';
  threshold: number;
  finalPrice: number;
  percentOff: number | null;
}
