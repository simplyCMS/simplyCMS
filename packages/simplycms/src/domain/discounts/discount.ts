// Оцінка однієї знижки (Е6в-5…Е6в-7): активність, дати, цілі, умови.

import type {
  AppliedDiscount,
  Discount,
  DiscountContext,
  DiscountRejectionReason,
  DiscountTarget,
  RejectedDiscount,
} from 'simplycms/contracts';
import { failedCondition } from './conditions';

/** Внесок групи: сума, що увійшла, і пояснення кожної знижки піддерева. */
export interface GroupOutcome {
  amount: number;
  applied: AppliedDiscount[];
  rejected: RejectedDiscount[];
}

export function isWithinDates(
  startsAt: Date | null,
  endsAt: Date | null,
  now: Date,
): boolean {
  return !(startsAt && startsAt > now) && !(endsAt && endsAt < now);
}

/** Порожній список цілей — fail-closed (Е6в-7): «на все» лише явним `all`. */
export function matchesTarget(
  targets: readonly DiscountTarget[],
  item: DiscountContext['item'],
): boolean {
  return targets.some(
    (t) =>
      t.target_type === 'all' ||
      (t.target_type === 'product' && t.target_id === item.productId) ||
      (t.target_type === 'modification' &&
        t.target_id === item.modificationId) ||
      (t.target_type === 'section' && t.target_id === item.sectionId),
  );
}

export function toRejected(
  entry: { id: string; name: string; groupName: string },
  reason: DiscountRejectionReason,
  conditionType: string | null = null,
): RejectedDiscount {
  const { id, name, groupName } = entry;
  return { id, name, groupName, reason, conditionType };
}

function discountAmount(basePrice: number, d: Discount): number {
  if (d.discount_type === 'percent')
    return basePrice * (d.discount_value / 100);
  if (d.discount_type === 'fixed_amount')
    return Math.min(d.discount_value, basePrice);
  return Math.max(0, basePrice - d.discount_value);
}

export function evaluateDiscount(
  d: Discount,
  groupName: string,
  basePrice: number,
  ctx: DiscountContext,
): GroupOutcome {
  const entry = { id: d.id, name: d.name, groupName };
  const fail = (
    reason: DiscountRejectionReason,
    type: string | null = null,
  ) => ({
    amount: 0,
    applied: [],
    rejected: [toRejected(entry, reason, type)],
  });
  if (!d.is_active) return fail('inactive');
  if (!isWithinDates(d.starts_at, d.ends_at, ctx.now))
    return fail('out_of_dates');
  if (!matchesTarget(d.targets, ctx.item)) return fail('target_mismatch');
  const failed = failedCondition(d.conditions, ctx);
  if (failed) return fail(failed.reason, failed.conditionType);
  const amount = discountAmount(basePrice, d);
  const applied: AppliedDiscount = {
    ...entry,
    type: d.discount_type,
    value: d.discount_value,
    calculatedAmount: amount,
  };
  return { amount, applied: [applied], rejected: [] };
}
