import { and, asc, count, eq, isNull } from 'drizzle-orm';
import {
  pickupPoints,
  productModifications,
  products,
  stockByPickupPoint,
} from 'simplycms/schema';
import type { StockStatus } from 'simplycms/contracts';
import type { ActorDb } from './db';

/** Залишок на одній точці видачі. */
export interface StockByPointRow {
  point_id: string;
  point_name: string;
  quantity: number;
}

/** Наявність товару або модифікації — те, що малює блок наявності. */
export interface StockInfoRow {
  totalQuantity: number;
  isAvailable: boolean;
  stockStatus: StockStatus | null;
  byPoint: StockByPointRow[];
}

/** Що саме питаємо: модифікацію (пріоритет) або простий товар. */
export interface StockTarget {
  productId?: string | null;
  modificationId?: string | null;
}

const EMPTY: StockInfoRow = {
  totalQuantity: 0,
  isAvailable: false,
  stockStatus: null,
  byPoint: [],
};

/**
 * Наявність із розкладкою по точках видачі — заміна функції БД
 * `get_stock_info`, якої в схемі v2 НЕМАЄ (baseline B13 не везе жодної
 * plpgsql-функції, крім читача актора).
 *
 * Правило доступності збережено дослівно: доступно, якщо є залишок АБО
 * статус — «під замовлення».
 *
 * 🔴 `is_active` точок видачі фільтрується КОДОМ: RLS на `pickup_points`
 * немає, і без предиката покупець побачив би залишок на складі, який магазин
 * закрив, — тобто пообіцяв би самовивіз звідти, звідки видачі більше немає.
 */
export async function loadStockInfo(
  db: ActorDb,
  target: StockTarget,
): Promise<StockInfoRow> {
  const stockStatus = await loadStockStatus(db, target);
  if (stockStatus === undefined) return EMPTY;

  const scope = target.modificationId
    ? eq(stockByPickupPoint.modificationId, target.modificationId)
    : and(
        eq(stockByPickupPoint.productId, target.productId ?? ''),
        isNull(stockByPickupPoint.modificationId),
      );

  const rows = await db
    .select({
      point_id: pickupPoints.id,
      point_name: pickupPoints.name,
      quantity: stockByPickupPoint.quantity,
    })
    .from(stockByPickupPoint)
    .innerJoin(
      pickupPoints,
      eq(pickupPoints.id, stockByPickupPoint.pickupPointId),
    )
    .where(and(scope, eq(pickupPoints.isActive, true)))
    .orderBy(asc(pickupPoints.sortOrder));

  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  return {
    totalQuantity,
    isAvailable: totalQuantity > 0 || stockStatus === 'on_order',
    stockStatus,
    byPoint: rows,
  };
}

/**
 * Статус наявності цілі: `undefined` — рядка немає взагалі (тоді питати
 * залишки нема про що), `null` — рядок є, статус не заданий.
 */
async function loadStockStatus(
  db: ActorDb,
  target: StockTarget,
): Promise<StockStatus | null | undefined> {
  if (target.modificationId) {
    const [row] = await db
      .select({ status: productModifications.stockStatus })
      .from(productModifications)
      .where(eq(productModifications.id, target.modificationId))
      .limit(1);
    return row === undefined ? undefined : row.status;
  }
  if (!target.productId) return undefined;

  const [row] = await db
    .select({ status: products.stockStatus })
    .from(products)
    .where(eq(products.id, target.productId))
    .limit(1);
  return row === undefined ? undefined : row.status;
}

/**
 * Скільки точок видачі активні. Одна точка — розкладка по складах не
 * показується взагалі, тож це число вирішує форму блока наявності.
 */
export async function loadActivePickupPointsCount(
  db: ActorDb,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(pickupPoints)
    .where(eq(pickupPoints.isActive, true));

  return Number(row?.total ?? 0);
}
