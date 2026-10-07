// Вбудовані умови знижок (Е6в-4): чотири типи, зареєстровані тим самим
// контрактом `DiscountConditionDefinition`, що й майбутні умови плагінів.

import { MAX_LINE_QUANTITY } from 'simplycms/contracts/cart-limits';
import { toCents } from '../pricing';
import type { DiscountConditionDefinition } from './types';

const NUMERIC_OPERATORS = ['>=', '>', '<=', '<', '='] as const;
type NumericOperator = (typeof NUMERIC_OPERATORS)[number];

/** Розібрана числова умова — вхід і для оцінки, і для порогових підказок. */
export interface NumericConfig {
  operator: NumericOperator;
  value: number;
}

const isNumericOperator = (op: string): op is NumericOperator =>
  (NUMERIC_OPERATORS as readonly string[]).includes(op);

function compare(actual: number, operator: NumericOperator, expected: number) {
  if (operator === '>=') return actual >= expected;
  if (operator === '>') return actual > expected;
  if (operator === '<=') return actual <= expected;
  if (operator === '<') return actual < expected;
  return actual === expected;
}

/**
 * Досяжні межі значення `min_quantity` для оператора (ред.4): кількість у
 * рядку — ціле 1…`MAX_LINE_QUANTITY`, тож `> 999` і `< 1` не виконаються
 * ніколи. Така умова — мертва акція, яку адмінка не має дозволити записати.
 */
function quantityBounds(operator: NumericOperator): [number, number] {
  if (operator === '>') return [1, MAX_LINE_QUANTITY - 1];
  if (operator === '<') return [2, MAX_LINE_QUANTITY];
  return [1, MAX_LINE_QUANTITY];
}

export const userCategoryCondition: DiscountConditionDefinition<{
  operator: 'in' | 'not_in';
  ids: readonly string[];
}> = {
  type: 'user_category',
  parse(operator, value) {
    if (operator !== 'in' && operator !== 'not_in') return null;
    if (!Array.isArray(value) || value.length === 0) return null;
    const ids = value.filter((id): id is string => typeof id === 'string');
    return ids.length === value.length && ids.every(Boolean)
      ? { operator, ids }
      : null;
  },
  // Покупець без категорії не проходить ні `in`, ні `not_in`: сервер завжди
  // підставляє дефолтну, тож `null` — це збій даних, а не «чужа категорія».
  evaluate({ operator, ids }, ctx) {
    const id = ctx.customer.categoryId;
    if (id === null) return false;
    return operator === 'in' ? ids.includes(id) : !ids.includes(id);
  },
};

export const minQuantityCondition: DiscountConditionDefinition<NumericConfig> =
  {
    type: 'min_quantity',
    parse(operator, value) {
      if (!isNumericOperator(operator)) return null;
      if (typeof value !== 'number' || !Number.isInteger(value)) return null;
      const [min, max] = quantityBounds(operator);
      return value >= min && value <= max ? { operator, value } : null;
    },
    evaluate: ({ operator, value }, ctx) =>
      compare(ctx.item.quantity, operator, value),
  };

export const minOrderAmountCondition: DiscountConditionDefinition<NumericConfig> =
  {
    type: 'min_order_amount',
    parse(operator, value) {
      if (!isNumericOperator(operator)) return null;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
        return null;
      return { operator, value };
    },
    // 🔴 Центами (Е6в-9): `0.1 + 0.2 > 0.3` у JS — істина.
    evaluate: ({ operator, value }, ctx) =>
      compare(toCents(ctx.cart.total), operator, toCents(value)),
  };

export const userLoggedInCondition: DiscountConditionDefinition<boolean> = {
  type: 'user_logged_in',
  parse: (operator, value) =>
    operator === '=' && typeof value === 'boolean' ? value : null,
  evaluate: (expected, ctx) => ctx.customer.isLoggedIn === expected,
};
