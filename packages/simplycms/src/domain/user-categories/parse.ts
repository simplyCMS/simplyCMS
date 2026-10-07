// Ручний guard умов автоправила (Е6в-19, ред.2/ред.5). Один розбір для двох
// входів: Zod адмінки (`refine` колонки `conditions`) і читання правила з БД
// рушієм (`commerce/customer-categories.ts`) — рядок, вписаний SQL-ем в
// обхід Zod, не спрацьовує, а не валить оформлення замовлення.

import type {
  CategoryRuleCondition,
  CategoryRuleConditions,
  CategoryRuleField,
  CategoryRuleOperator,
} from './types';

const NUMERIC_OPERATORS = ['>=', '>', '<=', '<', '='] as const;
const TEXT_OPERATORS = ['=', 'contains'] as const;

/**
 * Допустимі оператори за полем (ред.5). Перелік — і для guard-а, і для
 * вибору оператора у формі правила (Task 9).
 */
export const CATEGORY_RULE_FIELD_OPERATORS: Readonly<
  Record<CategoryRuleField, readonly CategoryRuleOperator[]>
> = {
  total_purchases: NUMERIC_OPERATORS,
  orders_count: NUMERIC_OPERATORS,
  registration_days: NUMERIC_OPERATORS,
  email_domain: TEXT_OPERATORS,
  utm_source: TEXT_OPERATORS,
  utm_campaign: TEXT_OPERATORS,
  auth_provider: ['='],
};

/** Межа кількості умов одного правила (як у знижок). */
export const MAX_CATEGORY_RULE_CONDITIONS = 20;
const MAX_VALUE_LENGTH = 200;

const NUMERIC_FIELDS: readonly CategoryRuleField[] = [
  'total_purchases',
  'orders_count',
  'registration_days',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isField(value: unknown): value is CategoryRuleField {
  return typeof value === 'string' && value in CATEGORY_RULE_FIELD_OPERATORS;
}

function parseCondition(json: unknown): CategoryRuleCondition | null {
  if (!isRecord(json)) return null;
  const { field, operator, value } = json;
  if (!isField(field)) return null;
  const allowed = CATEGORY_RULE_FIELD_OPERATORS[field];
  if (!allowed.includes(operator as CategoryRuleOperator)) return null;
  if (typeof value !== 'string') return null;
  if (value.trim() === '' || value.length > MAX_VALUE_LENGTH) return null;
  if (NUMERIC_FIELDS.includes(field) && !Number.isFinite(Number(value)))
    return null;
  return { field, operator: operator as CategoryRuleOperator, value };
}

/**
 * Умови правила або `null`, якщо будь-яка частина невалідна: режим не
 * `all`/`any`, порожній чи задовгий список, невідоме поле, оператор поза
 * переліком поля, нечислове значення числового поля. Зайві ключі відкидаються.
 */
export function parseCategoryRuleConditions(
  json: unknown,
): CategoryRuleConditions | null {
  if (!isRecord(json)) return null;
  const { type, rules } = json;
  if (type !== 'all' && type !== 'any') return null;
  if (!Array.isArray(rules)) return null;
  if (rules.length === 0 || rules.length > MAX_CATEGORY_RULE_CONDITIONS)
    return null;
  const parsed: CategoryRuleCondition[] = [];
  for (const item of rules) {
    const condition = parseCondition(item);
    if (!condition) return null;
    parsed.push(condition);
  }
  return { type, rules: parsed };
}
