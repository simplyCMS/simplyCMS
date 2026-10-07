// Головний вхід рушія: корені лісу із залишком і центи (Е6в-5, Е6в-9).

import type {
  AppliedDiscount,
  DiscountContext,
  DiscountGroup,
  DiscountResult,
  RejectedDiscount,
} from 'simplycms/contracts';
import { toCents } from '../pricing';
import { toRejected } from './discount';
import { evaluateGroup } from './evaluate';

const byPriority = (a: DiscountGroup, b: DiscountGroup) =>
  a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Ціна позиції після знижок.
 *
 * Корені обходяться за пріоритетом із залишком (Е6в-5): накопичена сума
 * знижок обрізається базою, а частка кожної знижки — це приріст накопиченої
 * знижки в ЦІЛИХ центах. Знижка, що не додала жодного цента, іде в
 * `rejected` з `exceeds_price` — зокрема й знижка з власною сумою 0
 * (`fixed_price` ≥ бази). Інакше `applied` обіцяв би знижки, яких у сумі
 * немає (−100 % і −10 % «обидві» при ціні 0).
 *
 * 🔴 Центи, а не float: залишок у float пропускав субцентовий хвіст як
 * «застосовану» частку, а підгонка дрейфу на останню знижку давала їй
 * відʼємну суму. Приріст у центах невідʼємний за побудовою, а Σ
 * `calculatedAmount` = `totalDiscount` і `base − totalDiscount = finalPrice`
 * точні — `discount_data` замовлення пояснює чек до копійки.
 *
 * 🔴 Округлюється ЦІНА (накопичена), а знижка виводиться з неї — не навпаки:
 * ціна їде в `order_items.price`, сума позиції — price × quantity, тож
 * 20.01 −50 % мусить дати 10.01 (покупець рахує 3 × 10.01 = 30.03), а
 * округлення самої знижки 10.005 → 10.01 зсунуло б ціну до 10.00.
 */
export function resolveDiscount(
  basePrice: number,
  forest: DiscountGroup[],
  ctx: DiscountContext,
): DiscountResult {
  const applied: AppliedDiscount[] = [];
  const rejected: RejectedDiscount[] = [];
  const base = Math.max(0, basePrice);
  const baseCents = toCents(base);
  let takenRaw = 0;
  let takenCents = 0;

  for (const root of [...forest].sort(byPriority)) {
    const outcome = evaluateGroup(root, basePrice, ctx);
    rejected.push(...outcome.rejected);
    for (const entry of outcome.applied) {
      takenRaw = Math.min(base, takenRaw + Math.max(0, entry.calculatedAmount));
      const reachedCents = baseCents - toCents(base - takenRaw);
      const share = reachedCents - takenCents;
      if (share <= 0) {
        rejected.push(toRejected(entry, 'exceeds_price'));
        continue;
      }
      applied.push({ ...entry, calculatedAmount: share / 100 });
      takenCents = reachedCents;
    }
  }

  return {
    finalPrice: (baseCents - takenCents) / 100,
    totalDiscount: takenCents / 100,
    appliedDiscounts: applied,
    rejectedDiscounts: rejected,
  };
}
