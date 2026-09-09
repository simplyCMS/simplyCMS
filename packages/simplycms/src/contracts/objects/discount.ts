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
  name: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  priority: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
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
  starts_at: string | null;
  ends_at: string | null;
  discounts: Discount[];
  children: DiscountGroup[];
}

export interface DiscountContext {
  userId?: string | null;
  userCategoryId?: string | null;
  quantity: number;
  cartTotal: number;
  productId: string;
  modificationId?: string | null;
  sectionId?: string | null;
  isLoggedIn: boolean;
  now?: Date;
}

export interface AppliedDiscount {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  calculatedAmount: number;
  groupName: string;
}

export interface RejectedDiscount {
  id: string;
  name: string;
  reason: string;
  groupName: string;
}

export interface DiscountResult {
  finalPrice: number;
  totalDiscount: number;
  appliedDiscounts: AppliedDiscount[];
  rejectedDiscounts: RejectedDiscount[];
}

/** Скоуп для CatalogRepository.getDiscounts — фільтр доступних знижок. */
export interface DiscountScope {
  productId?: string;
  sectionId?: string;
  userCategoryId?: string | null;
  /** Тип ціни (price list), за яким відбираються знижки. */
  priceTypeId?: string | null;
}
