// Реєстр умов знижок (Е6в-4). Вбудовані типи реєструються тим самим
// контрактом, яким у К5 реєструватимуть свої умови плагіни.

import type {
  DiscountCondition,
  DiscountContext,
  DiscountRejectionReason,
  Json,
} from 'simplycms/contracts';
import {
  minOrderAmountCondition,
  minQuantityCondition,
  userCategoryCondition,
  userLoggedInCondition,
} from './built-in-conditions';
import type { DiscountConditionDefinition } from './types';

/** Вбудовані типи умов — у порядку, в якому їх показує форма адмінки. */
export const BUILT_IN_DISCOUNT_CONDITIONS = [
  'user_category',
  'min_quantity',
  'min_order_amount',
  'user_logged_in',
] as const;

const REGISTRY = new Map<string, DiscountConditionDefinition<unknown>>();

/**
 * 🔴 Звуження до `<unknown>` безпечне: конфіг, який отримує `evaluate`,
 * завжди походить із `parse` ТОГО САМОГО визначення (`failedCondition`).
 */
function register<C>(definition: DiscountConditionDefinition<C>): void {
  REGISTRY.set(
    definition.type,
    definition as unknown as DiscountConditionDefinition<unknown>,
  );
}

register(userCategoryCondition);
register(minQuantityCondition);
register(minOrderAmountCondition);
register(userLoggedInCondition);

export function getDiscountCondition(
  type: string,
): DiscountConditionDefinition<unknown> | undefined {
  return REGISTRY.get(type);
}

/** Чи валідна умова — для `refine` адмінського Zod (невідомий тип — ні). */
export function parseDiscountCondition(
  type: string,
  operator: string,
  value: Json,
): boolean {
  return getDiscountCondition(type)?.parse(operator, value) != null;
}

/**
 * Перша умова знижки, що не пройшла, або `null`. Невідомий тип і значення
 * поза контрактом — `condition_unknown`: рушій цієї умови не розуміє, і
 * адмінка має сказати саме це, а не «покупець не підходить».
 */
export function failedCondition(
  conditions: readonly DiscountCondition[],
  ctx: DiscountContext,
): { reason: DiscountRejectionReason; conditionType: string } | null {
  for (const { condition_type, operator, value } of conditions) {
    const definition = getDiscountCondition(condition_type);
    const config = definition?.parse(operator, value) ?? null;
    if (!definition || config === null)
      return { reason: 'condition_unknown', conditionType: condition_type };
    if (!definition.evaluate(config, ctx))
      return { reason: 'condition_failed', conditionType: condition_type };
  }
  return null;
}
