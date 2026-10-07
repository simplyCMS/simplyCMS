import type { getDiscount, saveDiscount } from 'simplycms/admin-server';
import type { Discount } from 'simplycms/schema/types';
import {
  keepUnchangedDate,
  toDateTimeLocal,
} from '../../../lib/datetime-local';
import { ALL_PRICE_TYPES } from '../discount-labels';
import type {
  DiscountFormInput,
  DiscountFormValues,
  FormTarget,
} from './discount-form-schema';

export type LoadedDiscount = Awaited<ReturnType<typeof getDiscount>>;
export type SaveDiscountData = Parameters<typeof saveDiscount>[0]['data'];
type ConditionValue = SaveDiscountData['conditions'][number]['value'];

/**
 * Порожня форма нової знижки. Цілей немає навмисно: «на все» — явний вибір
 * власника (Е6в-7), а не тиха підстановка.
 */
export function emptyDiscountForm(
  groupId: string | undefined,
): DiscountFormInput {
  return {
    name: '',
    description: '',
    groupId: groupId ?? '',
    discountType: 'percent',
    discountValue: 10,
    priceTypeId: ALL_PRICE_TYPES,
    priority: 0,
    isActive: true,
    startsAt: '',
    endsAt: '',
    targets: [],
    conditions: [],
  };
}

/** Відповідь `getDiscount` → значення форми. */
export function toDiscountForm({
  discount: d,
  targets,
  conditions,
}: LoadedDiscount): DiscountFormInput {
  return {
    name: d.name,
    description: d.description ?? '',
    groupId: d.groupId,
    discountType: d.discountType,
    discountValue: Number(d.discountValue),
    priceTypeId: d.priceTypeId ?? ALL_PRICE_TYPES,
    priority: d.priority,
    isActive: d.isActive,
    startsAt: toDateTimeLocal(d.startsAt),
    endsAt: toDateTimeLocal(d.endsAt),
    targets: targets.map((t) => ({
      targetType: t.targetType,
      targetId: t.targetType === 'all' ? null : t.targetId,
    })),
    conditions: conditions.map((c) => ({
      conditionType: c.conditionType,
      operator: c.operator,
      value: c.value,
    })),
  };
}

const toTarget = (t: FormTarget): SaveDiscountData['targets'][number] =>
  t.targetType === 'all'
    ? { targetType: 'all', targetId: null }
    : { targetType: t.targetType, targetId: t.targetId ?? '' };

/**
 * Значення форми → вхід `saveDiscount`. Дати, яких власник не чіпав, —
 * вихідні `Date` рядка (Е6в-22 ред.2), а не кругообіг через рядок поля.
 */
export function toSaveInput(
  v: DiscountFormValues,
  id: string,
  original: Discount | undefined,
): SaveDiscountData {
  return {
    id,
    groupId: v.groupId,
    name: v.name,
    description: v.description.trim() || null,
    discountType: v.discountType,
    discountValue: v.discountValue,
    priceTypeId: v.priceTypeId === ALL_PRICE_TYPES ? null : v.priceTypeId,
    priority: v.priority,
    isActive: v.isActive,
    startsAt: keepUnchangedDate(v.startsAt, original?.startsAt ?? null),
    endsAt: keepUnchangedDate(v.endsAt, original?.endsAt ?? null),
    targets: v.targets.map(toTarget),
    // Значення вже пройшли реєстр у схемі форми — тут вони JSON.
    conditions: v.conditions.map((c) => ({
      conditionType: c.conditionType,
      operator: c.operator,
      value: c.value as ConditionValue,
    })),
  };
}
