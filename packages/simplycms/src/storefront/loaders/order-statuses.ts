import { asc, eq } from 'drizzle-orm';
import type { TextLocale } from 'simplycms/domain/translations';
import { orderStatuses } from 'simplycms/schema';
import type { ActorDb } from './db';
import { orderStatusColumns, type OrderStatusRow } from './entities/order';

/** Довідник статусів — публічний (грант `select` для `app_user`). */
export async function loadOrderStatuses(
  db: ActorDb,
  text: TextLocale,
): Promise<OrderStatusRow[]> {
  return db
    .select(orderStatusColumns(text))
    .from(orderStatuses)
    .orderBy(asc(orderStatuses.sortOrder));
}

/** Ідентифікатор статусу за кодом — потрібен скасуванню замовлення (назва йому не потрібна). */
export async function loadStatusIdByCode(
  db: ActorDb,
  code: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: orderStatuses.id })
    .from(orderStatuses)
    .where(eq(orderStatuses.code, code))
    .limit(1);

  return row?.id ?? null;
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
