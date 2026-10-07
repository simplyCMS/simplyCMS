// Розбір ОДНОГО рядка правил знижок: невалідне поле — виняток із шляхом.
// Ловить його `parseDiscountRules` (порядковий fail-closed, Е6в-25).
import type {
  Discount,
  DiscountCondition,
  DiscountTarget,
  DiscountType,
  GroupOperator,
  Json,
  TargetType,
} from 'simplycms/contracts';
import type { DiscountGroupRow } from 'simplycms/domain/discounts';
import { fields, list, obj } from './json-fields';

const OPERATORS: readonly GroupOperator[] = ['and', 'or', 'not', 'min', 'max'];
const TYPES: readonly DiscountType[] = [
  'percent',
  'fixed_amount',
  'fixed_price',
];
const TARGETS: readonly TargetType[] = [
  'product',
  'modification',
  'section',
  'all',
];

export function parseGroup(v: unknown, path: string): DiscountGroupRow {
  const f = fields(obj(v, path), path);
  return {
    id: f.str('id'),
    name: f.str('name'),
    description: f.strOrNull('description'),
    operator: f.oneOf('operator', OPERATORS),
    is_active: f.bool('is_active'),
    priority: f.int('priority'),
    starts_at: f.date('starts_at'),
    ends_at: f.date('ends_at'),
    parent_group_id: f.strOrNull('parent_group_id'),
  };
}

function parseTarget(v: unknown, path: string): DiscountTarget {
  const f = fields(obj(v, path), path);
  return {
    id: f.str('id'),
    target_type: f.oneOf('target_type', TARGETS),
    target_id: f.strOrNull('target_id'),
  };
}

function parseCondition(v: unknown, path: string): DiscountCondition {
  const o = obj(v, path);
  const f = fields(o, path);
  return {
    id: f.str('id'),
    condition_type: f.str('condition_type'),
    operator: f.str('operator'),
    // jsonb з `JSON.parse` драйвера — валідний JSON за побудовою; ЗМІСТ умови
    // перевіряє реєстр умов рушія (fail-closed), не ця межа.
    value: o.value as Json,
  };
}

export function parseDiscount(v: unknown, path: string): Discount {
  const o = obj(v, path);
  const f = fields(o, path);
  return {
    id: f.str('id'),
    group_id: f.str('group_id'),
    name: f.str('name'),
    description: f.strOrNull('description'),
    discount_type: f.oneOf('discount_type', TYPES),
    discount_value: f.decimal('discount_value'),
    priority: f.int('priority'),
    is_active: f.bool('is_active'),
    starts_at: f.date('starts_at'),
    ends_at: f.date('ends_at'),
    price_type_id: f.strOrNull('price_type_id'),
    targets: list(o.targets, `${path}.targets`).map((t, i) =>
      parseTarget(t, `${path}.targets[${i}]`),
    ),
    conditions: list(o.conditions, `${path}.conditions`).map((c, i) =>
      parseCondition(c, `${path}.conditions[${i}]`),
    ),
  };
}
