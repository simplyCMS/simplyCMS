// Головний вхід рушія: корені лісу із залишком і центи (Е6в-5, Е6в-9).

import type {
  AppliedDiscount,
  DiscountContext,
  DiscountGroup,
  DiscountResult,
  RejectedDiscount,
} from 'simplycms/contracts';
import { roundMoney, toCents } from '../pricing';
import { toRejected } from './discount';
import { evaluateGroup } from './evaluate';

const byPriority = (a: DiscountGroup, b: DiscountGroup) =>
  a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Σ `calculatedAmount` = `totalDiscount` ТОЧНО в центах: `discount_data`
 * замовлення пояснює чек, і пояснення, що не сходиться з ним на копійку,
 * — неправда. Дрейф округлення забирає остання ненульова знижка.
 */
function settleCents(
  applied: AppliedDiscount[],
  totalDiscount: number,
): AppliedDiscount[] {
  const cents = applied.map((a) => toCents(a.calculatedAmount));
  const drift = toCents(totalDiscount) - cents.reduce((s, c) => s + c, 0);
  const last = cents.findLastIndex((c) => c > 0);
  if (drift !== 0 && last >= 0) cents[last] += drift;
  return applied.map((a, i) => ({ ...a, calculatedAmount: cents[i] / 100 }));
}

/**
 * Ціна позиції після знижок.
 *
 * Корені обходяться за пріоритетом із залишком: знижка бере
 * `min(свою суму, залишок)`, а та, якій залишку вже немає, іде в
 * `rejected` з `exceeds_price`. Інакше `applied` обіцяв би знижки, яких у
 * сумі немає (−100 % і −10 % «обидві застосовані» при ціні 0).
 */
export function resolveDiscount(
  basePrice: number,
  forest: DiscountGroup[],
  ctx: DiscountContext,
): DiscountResult {
  const applied: AppliedDiscount[] = [];
  const rejected: RejectedDiscount[] = [];
  let taken = 0;

  for (const root of [...forest].sort(byPriority)) {
    const outcome = evaluateGroup(root, basePrice, ctx);
    rejected.push(...outcome.rejected);
    for (const entry of outcome.applied) {
      const share = Math.min(
        entry.calculatedAmount,
        Math.max(0, basePrice - taken),
      );
      if (share <= 0 && entry.calculatedAmount > 0) {
        rejected.push(toRejected(entry, 'exceeds_price'));
        continue;
      }
      applied.push({ ...entry, calculatedAmount: share });
      taken += share;
    }
  }

  // 🔴 Округлюємо ЦІНУ, а знижку виводимо з неї — не навпаки. Ціна — те, що
  // бачить покупець і що їде в `order_items.price`, а сума позиції рахується
  // як price × quantity; отже саме ціна мусить бути цілими центами (20.01
  // −50 % × 3: інакше в БД 30.015, а покупець рахує 3 × 10.01 = 30.03).
  // Виведення знижки з округленої ціни лишає `basePrice - totalDiscount ===
  // finalPrice` точною рівністю, а не наближенням.
  const finalPrice = roundMoney(Math.max(0, basePrice - taken));
  const totalDiscount = roundMoney(basePrice - finalPrice);

  return {
    finalPrice,
    totalDiscount,
    appliedDiscounts: settleCents(applied, totalDiscount),
    rejectedDiscounts: rejected,
  };
}
