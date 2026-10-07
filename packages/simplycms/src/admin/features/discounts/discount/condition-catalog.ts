import { BUILT_IN_DISCOUNT_CONDITIONS } from 'simplycms/domain/discounts';
import type { MessageKey } from 'simplycms/i18n';
import type { FormCondition } from './discount-form-schema';

export type BuiltInConditionType =
  (typeof BUILT_IN_DISCOUNT_CONDITIONS)[number];

export const isBuiltInCondition = (
  type: string,
): type is BuiltInConditionType =>
  (BUILT_IN_DISCOUNT_CONDITIONS as readonly string[]).includes(type);

export const CONDITION_LABEL: Record<BuiltInConditionType, MessageKey> = {
  user_category: 'admin.discounts.userCategory',
  min_quantity: 'admin.discounts.minQuantity',
  min_order_amount: 'admin.discounts.minTotal',
  user_logged_in: 'admin.discounts.authenticated',
};

/** Числові оператори реєстру (`built-in-conditions.ts`) — символом, не словом. */
export const NUMERIC_OPERATORS = [
  { value: '>=', text: '≥' },
  { value: '>', text: '>' },
  { value: '=', text: '=' },
  { value: '<=', text: '≤' },
  { value: '<', text: '<' },
] as const;

export const CATEGORY_OPERATORS = [
  { value: 'in', key: 'admin.discounts.condOp.in' },
  { value: 'not_in', key: 'admin.discounts.condOp.notIn' },
] as const satisfies readonly { value: string; key: MessageKey }[];

/**
 * Нова умова типу. Значення за замовчуванням навмисно НЕ завжди валідне:
 * `user_category` без жодної категорії реєстр відхиляє — власник мусить
 * обрати категорію, а не зберегти умову, що не виконується ніколи.
 */
export function defaultCondition(type: BuiltInConditionType): FormCondition {
  if (type === 'user_category')
    return { conditionType: type, operator: 'in', value: [] };
  if (type === 'user_logged_in')
    return { conditionType: type, operator: '=', value: true };
  return {
    conditionType: type,
    operator: '>=',
    value: type === 'min_quantity' ? 1 : 0,
  };
}
