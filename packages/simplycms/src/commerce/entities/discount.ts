import type {
  Discount,
  DiscountCondition,
  DiscountGroup,
  DiscountType,
  GroupOperator,
  Json,
  TargetType,
} from 'simplycms/contracts';
import type {
  discountConditions,
  discountGroups,
  discountTargets,
  discounts,
} from 'simplycms/schema';

/** Рядки БД у тій формі, в якій їх віддає Drizzle (`select()` без проєкції). */
export type DiscountGroupRow = typeof discountGroups.$inferSelect;
export type DiscountRow = typeof discounts.$inferSelect;
export type DiscountTargetRow = typeof discountTargets.$inferSelect;
export type DiscountConditionRow = typeof discountConditions.$inferSelect;

/** Вузол дерева знижок — порожній, доки не наповнений гілками й знижками. */
export function toDiscountGroupNode(row: DiscountGroupRow): DiscountGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    operator: row.operator as GroupOperator,
    is_active: row.isActive,
    priority: row.priority,
    starts_at: row.startsAt,
    ends_at: row.endsAt,
    discounts: [],
    children: [],
  };
}

/**
 * Знижка з приклеєними цілями й умовами.
 *
 * 🔴 `discount_value` проходить через `Number`: `numeric` у Postgres їде
 * рядком, і рушій домену мовчки склеїв би його конкатенацією замість
 * арифметики — тобто «10» + «5» дало б знижку 105.
 */
export function toDiscount(
  row: DiscountRow,
  targets: DiscountTargetRow[],
  conditions: DiscountConditionRow[],
): Discount {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    discount_type: row.discountType as DiscountType,
    discount_value: Number(row.discountValue),
    priority: row.priority,
    is_active: row.isActive,
    starts_at: row.startsAt,
    ends_at: row.endsAt,
    targets: targets
      .filter((target) => target.discountId === row.id)
      .map((target) => ({
        id: target.id,
        target_type: target.targetType as TargetType,
        target_id: target.targetId,
      })),
    conditions: conditions
      .filter((condition) => condition.discountId === row.id)
      .map(toDiscountCondition),
  };
}

function toDiscountCondition(row: DiscountConditionRow): DiscountCondition {
  return {
    id: row.id,
    condition_type: row.conditionType,
    operator: row.operator,
    value: row.value as Json,
  };
}
