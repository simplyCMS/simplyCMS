import { eq, sql } from 'drizzle-orm';
import { orderItems, orders } from 'simplycms/schema';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { quoteShippingCost, validateShippingChoice } from 'simplycms/commerce';
import type { ActorDb } from 'simplycms/db';
import type { OrderRow } from '../orders/resource';
import { orderProjection, stateConflict } from './editable';

/**
 * Грошова арифметика редагування позицій — у ЦІЛИХ центах (Е5б-13): ні
 * конкатенації рядків `numeric`, ні float-дрейфу (`3 × 1234.55`), ні
 * переповнення колонки при кількості 9999.
 */

/** Межа `numeric(12,2)` — `order_items.price/total`, `orders.subtotal/total`. */
export const MAX_CENTS_NUMERIC_12_2 = 999_999_999_999;
/** Межа `numeric(10,2)` — `orders.shipping_cost`. */
export const MAX_CENTS_NUMERIC_10_2 = 9_999_999_999;

const NUMERIC = /^(\d+)(?:\.(\d{1,2}))?$/;

/** Десятковий рядок `numeric` (`"0"`, `"1234.5"`, `"1234.50"`) → центи, без `parseFloat`. */
export function toCents(value: string): number {
  const match = NUMERIC.exec(value);
  if (!match) throw new Error(`[admin-server] не сума в центах: "${value}"`);
  const cents =
    Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents))
    throw new Error(`[admin-server] сума поза точністю: "${value}"`);
  return cents;
}

/** Ціна рушія (`number`, уже округлена `roundMoney`) → центи. */
export function centsFromNumber(value: number): number {
  return Math.round(value * 100);
}

/** Центи → рядок `"x.yy"` для запису в `numeric`. */
export function fromCents(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0)
    throw new Error(`[admin-server] некоректні центи: ${cents}`);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

/** Сума за межею колонки → 409 `order_amount_out_of_range` ДО запису (Е5б-13). */
export function assertWithin(cents: number, max: number): void {
  if (cents > max) stateConflict(ADMIN_STATE_CONSTRAINT.orderAmountOutOfRange);
}

/**
 * Кроки (6)–(8) КАНОНУ Е5б-8 — під уже взятим `orders … FOR UPDATE`, після
 * запису позиції:
 *
 * 6. `subtotal = Σ order_items.total` SQL-сумою (рядок) → центи.
 * 7. Доставка за правилами чекауту (Е5б-2): `validateShippingChoice` з
 *    методом, містом і точкою замовлення + `quoteShippingCost` від нового
 *    `subtotal`. Будь-яка відмова (метод вимкнено/`NULL`, точка недійсна,
 *    тарифу немає, мінімум/максимум суми) → 409 `order_shipping_unavailable`.
 * 8. Межі всіх трьох колонок — ДО `update orders set subtotal,
 *    shipping_cost, total = subtotal + shipping_cost, updated_at`.
 */
export async function recomputeOrderTotals(
  db: ActorDb,
  order: OrderRow,
): Promise<OrderRow> {
  const [sum] = await db
    .select({ value: sql<string>`coalesce(sum(${orderItems.total}), 0)::text` })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  const subtotal = toCents(sum!.value);

  const choice = await validateShippingChoice(db, {
    methodId: order.shippingMethodId,
    deliveryCity: order.deliveryCity,
    pickupPointId: order.pickupPointId,
  });
  const cost =
    typeof choice === 'string'
      ? null
      : quoteShippingCost(choice, subtotal / 100);
  if (cost === null)
    stateConflict(ADMIN_STATE_CONSTRAINT.orderShippingUnavailable);
  const shipping = toCents(cost.toFixed(2));
  const total = subtotal + shipping;
  // Захисна: окремо тестом не пінується — її перекриває assertWithin(total) за побудовою (Е5б-17).
  assertWithin(subtotal, MAX_CENTS_NUMERIC_12_2);
  assertWithin(shipping, MAX_CENTS_NUMERIC_10_2);
  assertWithin(total, MAX_CENTS_NUMERIC_12_2);

  const [updated] = (await db
    .update(orders)
    .set({
      subtotal: fromCents(subtotal),
      shippingCost: fromCents(shipping),
      total: fromCents(total),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id))
    .returning(orderProjection as never)) as OrderRow[];
  return updated!;
}
