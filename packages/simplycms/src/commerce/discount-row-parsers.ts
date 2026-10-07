// Розбір ОДНОГО рядка правил знижок: невалідне поле — виняток із шляхом.
// Ловить його `parseDiscountRules` (порядковий fail-closed, Е6в-25).
// Крім форми поля, тут перевіряються ті самі СЕМАНТИЧНІ межі, що й Zod
// `saveDiscount` (друга лінія Е6в-25): рядок, вставлений SQL-ем в обхід
// запису, інакше давав би ціну 0 чи знижку «на все» мовчки.
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
import { fail, fields, list, obj } from './json-fields';

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

/**
 * 🔴 `target_id` — `null` рівно для `all`. Ціль `product`/`section`/
 * `modification` з `NULL` інакше збіглася б у `matchesTarget` з КОЖНОЮ
 * позицією без розділу чи модифікації (`null === null`), а `all` з id
 * виглядала б для власника звуженою, хоча діє на все.
 */
function parseTarget(v: unknown, path: string): DiscountTarget {
  const f = fields(obj(v, path), path);
  const targetType = f.oneOf('target_type', TARGETS);
  const targetId = f.strOrNull('target_id');
  if ((targetType === 'all') !== (targetId === null))
    fail(`${path}.target_id`, targetId);
  return { id: f.str('id'), target_type: targetType, target_id: targetId };
}

/**
 * Значення знижки — як у Zod запису: `> 0`, відсоток `≤ 100`. Відсоток 150
 * дав би ціну 0, а відʼємна `fixed_amount` — «знижку», що підіймає ціну й
 * виграє в групі `min`.
 */
function discountValue(
  type: DiscountType,
  value: number,
  path: string,
): number {
  if (value <= 0 || (type === 'percent' && value > 100))
    fail(`${path}.discount_value`, value);
  return value;
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
  const type = f.oneOf('discount_type', TYPES);
  return {
    id: f.str('id'),
    group_id: f.str('group_id'),
    name: f.str('name'),
    description: f.strOrNull('description'),
    discount_type: type,
    discount_value: discountValue(type, f.decimal('discount_value'), path),
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
