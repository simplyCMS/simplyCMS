import { and, eq, isNull, or } from 'drizzle-orm';
import { productModifications, products } from 'simplycms/schema';
import type { StockStatus } from 'simplycms/contracts';
import type { ActorDb } from './db';
import type { StockTarget } from './stock-write';

/**
 * Поточний статус цілі.
 *
 * 🔴 Потрібен `reserveStock`, щоб розпізнати `on_order` (рішення архітектора
 * B, К2-Е0): для такої цілі достатність залишку НЕ перевіряється — товар
 * «під замовлення» продається і на нулі, і в мінус (борг постачанню).
 * `null` — рядок є, статус не заданий (DEFAULT схеми — `in_stock`,
 * `isPurchasable(null) === true`, Task 8); рядка немає взагалі — теж `null`,
 * бо викликачу цього модуля важливо лише «чи `on_order`», а «рядка немає» і
 * так виходить з `lockTargetStock` окремою гілкою.
 */
export async function loadTargetStatus(
  db: ActorDb,
  target: StockTarget,
): Promise<StockStatus | null> {
  if (target.modificationId) {
    const [row] = await db
      .select({ status: productModifications.stockStatus })
      .from(productModifications)
      .where(eq(productModifications.id, target.modificationId))
      .limit(1);
    return row?.status ?? null;
  }
  if (!target.productId) return null;
  const [row] = await db
    .select({ status: products.stockStatus })
    .from(products)
    .where(eq(products.id, target.productId))
    .limit(1);
  return row?.status ?? null;
}

/**
 * Переводить статус цілі — ГВАРДОВАНО.
 *
 * 🔴 `on_order` не чіпається ніколи: «під замовлення» — рішення магазину, що
 * товар продається й на нулі (`isPurchasable('on_order') === true`, Task 8),
 * і безумовний фліп затер би його. Тому в `out_of_stock` переходять лише
 * `in_stock` і NULL, а назад в `in_stock` — лише `out_of_stock`.
 *
 * 🔴 Матриця сама по собі пари взаємно оберненою НЕ робить: `in_stock` і
 * NULL зводяться в `out_of_stock` в один стан. Умову «повернути рівно те, що
 * було» тримає ВИКЛИКАЧ — `releaseStock` фліпає назад лише з нуля (див. його
 * гвард), інакше скасування старого замовлення підняло б у продаж товар,
 * який магазин зняв вручну.
 *
 * 🔴 `updatedAt` — `Date`, а не ISO-рядок: після «Контракту дат» (Е0-2) усі
 * timestamp схеми — `mode: 'date'`, тож запис рядка сюди — помилка типу.
 */
export async function setTargetStatus(
  db: ActorDb,
  target: StockTarget,
  next: 'in_stock' | 'out_of_stock',
): Promise<void> {
  const updatedAt = new Date();
  if (target.modificationId) {
    const col = productModifications.stockStatus;
    const from =
      next === 'out_of_stock'
        ? or(isNull(col), eq(col, 'in_stock'))
        : eq(col, 'out_of_stock');
    await db
      .update(productModifications)
      .set({ stockStatus: next, updatedAt })
      .where(and(eq(productModifications.id, target.modificationId), from));
    return;
  }
  if (!target.productId) return;
  const col = products.stockStatus;
  const from =
    next === 'out_of_stock'
      ? or(isNull(col), eq(col, 'in_stock'))
      : eq(col, 'out_of_stock');
  await db
    .update(products)
    .set({ stockStatus: next, updatedAt })
    .where(and(eq(products.id, target.productId), from));
}
