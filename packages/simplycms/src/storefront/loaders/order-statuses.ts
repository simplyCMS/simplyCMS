import { asc, eq } from 'drizzle-orm';
import { orderStatuses } from 'simplycms/schema';
import type { ActorDb } from './db';
import { orderStatusColumns, type OrderStatusRow } from './entities/order';

/** Довідник статусів — публічний (грант `select` для `app_user`). */
export async function loadOrderStatuses(
  db: ActorDb,
): Promise<OrderStatusRow[]> {
  return db
    .select(orderStatusColumns)
    .from(orderStatuses)
    .orderBy(asc(orderStatuses.sortOrder));
}

/** Статус за кодом — потрібен скасуванню замовлення. */
export async function loadStatusByCode(
  db: ActorDb,
  code: string,
): Promise<OrderStatusRow | null> {
  const [row] = await db
    .select(orderStatusColumns)
    .from(orderStatuses)
    .where(eq(orderStatuses.code, code))
    .limit(1);

  return row ?? null;
}

/** Статус за замовчуванням — з ним створюється нове замовлення. */
export async function loadDefaultStatusId(db: ActorDb): Promise<string | null> {
  const [row] = await db
    .select({ id: orderStatuses.id })
    .from(orderStatuses)
    .where(eq(orderStatuses.isDefault, true))
    .limit(1);

  return row?.id ?? null;
}
