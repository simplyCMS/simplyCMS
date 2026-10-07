// Оцінка групи (Е6в-5): результат групи — ФАКТИЧНО застосоване.

import type {
  Discount,
  DiscountContext,
  DiscountGroup,
  DiscountRejectionReason,
  GroupOperator,
  RejectedDiscount,
} from 'simplycms/contracts';
import {
  evaluateDiscount,
  isWithinDates,
  toRejected,
  type GroupOutcome,
} from './discount';

/** Неактивна чи позадатна група: кожна знижка піддерева пояснюється нею. */
function rejectSubtree(
  group: DiscountGroup,
  reason: DiscountRejectionReason,
): RejectedDiscount[] {
  return [
    ...group.discounts.map((d) =>
      toRejected({ ...d, groupName: group.name }, reason),
    ),
    ...group.children.flatMap((child) => rejectSubtree(child, reason)),
  ];
}

type Candidate =
  | { priority: number; id: string; discount: Discount }
  | { priority: number; id: string; group: DiscountGroup };

/**
 * ОДИН список кандидатів (ред.2): менше `priority` — раніше; при рівності
 * пряма знижка перед групою, далі за `id`. Окремі списки давали прямій
 * знижці з `priority` 100 перемогу в `or` над групою з 0.
 */
function candidates(group: DiscountGroup): Candidate[] {
  const list: Candidate[] = [
    ...group.discounts.map((d) => ({
      priority: d.priority,
      id: d.id,
      discount: d,
    })),
    ...group.children.map((g) => ({
      priority: g.priority,
      id: g.id,
      group: g,
    })),
  ];
  const rank = (c: Candidate) => ('discount' in c ? 0 : 1);
  return list.sort(
    (a, b) =>
      a.priority - b.priority ||
      rank(a) - rank(b) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

function pickWinners(op: GroupOperator, live: GroupOutcome[]): GroupOutcome[] {
  if (live.length === 0 || op === 'not') return [];
  if (op === 'and') return live;
  if (op === 'or') return [live[0]];
  const better = (a: GroupOutcome, b: GroupOutcome) =>
    op === 'min' ? b.amount < a.amount : b.amount > a.amount;
  return [live.reduce((best, next) => (better(best, next) ? next : best))];
}

export function evaluateGroup(
  group: DiscountGroup,
  basePrice: number,
  ctx: DiscountContext,
): GroupOutcome {
  if (!group.is_active)
    return {
      amount: 0,
      applied: [],
      rejected: rejectSubtree(group, 'group_inactive'),
    };
  if (!isWithinDates(group.starts_at, group.ends_at, ctx.now))
    return {
      amount: 0,
      applied: [],
      rejected: rejectSubtree(group, 'group_out_of_dates'),
    };

  const rejected: RejectedDiscount[] = [];
  const live: GroupOutcome[] = [];
  for (const c of candidates(group)) {
    const outcome =
      'discount' in c
        ? evaluateDiscount(c.discount, group.name, basePrice, ctx)
        : evaluateGroup(c.group, basePrice, ctx);
    rejected.push(...outcome.rejected);
    if (outcome.applied.length > 0) live.push(outcome);
  }

  const winners = pickWinners(group.operator, live);
  const lost = live
    .filter((o) => !winners.includes(o))
    .flatMap((o) => o.applied);
  rejected.push(...lost.map((a) => toRejected(a, 'lost_to_operator')));
  const applied = winners.flatMap((o) => o.applied);

  // `fixed_price` в `and` перемагає решту, як і до Е6в: дві ціни-«фікс» не
  // сумуються з відсотками осмислено.
  const fixed =
    group.operator === 'and'
      ? applied.find((a) => a.type === 'fixed_price')
      : undefined;
  if (fixed) {
    const others = applied.filter((a) => a !== fixed);
    rejected.push(...others.map((a) => toRejected(a, 'lost_to_operator')));
    return { amount: fixed.calculatedAmount, applied: [fixed], rejected };
  }
  return {
    amount: winners.reduce((sum, o) => sum + o.amount, 0),
    applied,
    rejected,
  };
}
