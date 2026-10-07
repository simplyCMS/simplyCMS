// Порогові підказки (Е6в-12): «від 3 шт — 900 ₴/шт».

import type {
  DiscountContext,
  DiscountGroup,
  ThresholdHint,
} from 'simplycms/contracts';
import { toCents } from '../pricing';
import {
  minOrderAmountCondition,
  minQuantityCondition,
  type NumericConfig,
} from './built-in-conditions';
import { matchesTarget } from './discount';
import { resolveDiscount } from './resolve';

type Kind = ThresholdHint['kind'];
const KIND_ORDER: readonly Kind[] = ['quantity', 'cart_total'];

/** Найменше значення, що виконує умову; `null` — оператор порогу не має. */
function thresholdOf(kind: Kind, { operator, value }: NumericConfig) {
  if (operator === '>=') return value;
  if (operator !== '>') return null;
  return kind === 'quantity' ? value + 1 : (toCents(value) + 1) / 100;
}

/** Пороги `min_quantity`/`min_order_amount` знижок, ціль яких — цей товар. */
function collectThresholds(
  forest: DiscountGroup[],
  ctx: DiscountContext,
): { kind: Kind; threshold: number }[] {
  const found = new Map<string, { kind: Kind; threshold: number }>();
  const walk = (group: DiscountGroup): void => {
    for (const d of group.discounts) {
      if (!matchesTarget(d.targets, ctx.item)) continue;
      for (const c of d.conditions) {
        const kind: Kind | null =
          c.condition_type === 'min_quantity'
            ? 'quantity'
            : c.condition_type === 'min_order_amount'
              ? 'cart_total'
              : null;
        if (!kind) continue;
        const definition =
          kind === 'quantity' ? minQuantityCondition : minOrderAmountCondition;
        const config = definition.parse(c.operator, c.value);
        const threshold = config && thresholdOf(kind, config);
        if (threshold === null) continue;
        const above =
          kind === 'quantity'
            ? threshold > ctx.item.quantity
            : toCents(threshold) > toCents(ctx.cart.total);
        if (above) found.set(`${kind}:${threshold}`, { kind, threshold });
      }
    }
    group.children.forEach(walk);
  };
  forest.forEach(walk);
  return [...found.values()];
}

/**
 * Гіпотетичний контекст на порозі (ред.2): для кількості решта кошика
 * лишається, а рядок доростає до T — тож підказка дорівнює ціні, яку дасть
 * квота кошика на порозі. Для суми кошик стає рівно T.
 */
function contextAt(
  basePrice: number,
  ctx: DiscountContext,
  kind: Kind,
  threshold: number,
): DiscountContext {
  if (kind === 'cart_total') return { ...ctx, cart: { total: threshold } };
  const q = ctx.item.quantity;
  const base = toCents(basePrice);
  const totalCents =
    Math.max(toCents(ctx.cart.total), base * q) + base * (threshold - q);
  return {
    ...ctx,
    item: { ...ctx.item, quantity: threshold },
    cart: { total: totalCents / 100 },
  };
}

/**
 * Підказки проганяють ТОЙ САМИЙ рушій на порозі, а не окрему формулу
 * відсотка: `or`/`min`/`max`/`not` на порозі можуть дати іншу знижку, ніж та,
 * чия умова спрацювала, і окрема формула розійшлася б із чеком.
 */
export function discountThresholdHints(
  basePrice: number,
  forest: DiscountGroup[],
  ctx: DiscountContext,
): ThresholdHint[] {
  const current = resolveDiscount(basePrice, forest, ctx).finalPrice;
  const hints: ThresholdHint[] = [];
  for (const { kind, threshold } of collectThresholds(forest, ctx)) {
    const r = resolveDiscount(
      basePrice,
      forest,
      contextAt(basePrice, ctx, kind, threshold),
    );
    if (r.finalPrice >= current) continue;
    const [only] = r.appliedDiscounts;
    const percentOff =
      r.appliedDiscounts.length === 1 && only.type === 'percent'
        ? only.value
        : null;
    hints.push({ kind, threshold, finalPrice: r.finalPrice, percentOff });
  }
  hints.sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      a.threshold - b.threshold,
  );
  // Дальший поріг, що не дешевший за ближчий того самого виду, — шум.
  const cheapest = new Map<Kind, number>();
  return hints.filter((hint) => {
    const previous = cheapest.get(hint.kind) ?? Infinity;
    if (hint.finalPrice >= previous) return false;
    cheapest.set(hint.kind, hint.finalPrice);
    return true;
  });
}
