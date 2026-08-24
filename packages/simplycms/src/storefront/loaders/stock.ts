import { and, inArray, isNull, sql } from 'drizzle-orm';
import { productModifications, stockByPickupPoint } from 'simplycms/schema';
import type { ActorDb } from './db';

/** Наявність однієї модифікації — форма, яку читає селектор на картці товару. */
export interface ModificationStockRow {
  totalQuantity: number;
  isAvailable: boolean;
}

/**
 * Сумарні залишки по модифікаціях: `modificationId → кількість`.
 *
 * 🔴 Сума рахується SQL-ом, а не в JS. Стара реалізація тягнула КОЖЕН рядок
 * `stock_by_pickup_point` у браузер і складала їх там — тобто розкладка
 * товару по точках видачі публікувалася назовні заради одного числа.
 */
export async function loadStockByModification(
  db: ActorDb,
  modificationIds: string[],
): Promise<Record<string, number>> {
  const byModification: Record<string, number> = {};
  if (modificationIds.length === 0) return byModification;

  const rows = await db
    .select({
      modification_id: stockByPickupPoint.modificationId,
      quantity: sql<string>`sum(${stockByPickupPoint.quantity})`,
    })
    .from(stockByPickupPoint)
    .where(inArray(stockByPickupPoint.modificationId, modificationIds))
    .groupBy(stockByPickupPoint.modificationId);

  for (const row of rows) {
    if (row.modification_id === null) continue;
    byModification[row.modification_id] = Number(row.quantity);
  }
  return byModification;
}

/** Сумарні залишки простих товарів (рядки без модифікації): `productId → кількість`. */
export async function loadStockByProduct(
  db: ActorDb,
  productIds: string[],
): Promise<Record<string, number>> {
  const byProduct: Record<string, number> = {};
  if (productIds.length === 0) return byProduct;

  const rows = await db
    .select({
      product_id: stockByPickupPoint.productId,
      quantity: sql<string>`sum(${stockByPickupPoint.quantity})`,
    })
    .from(stockByPickupPoint)
    .where(
      and(
        inArray(stockByPickupPoint.productId, productIds),
        isNull(stockByPickupPoint.modificationId),
      ),
    )
    .groupBy(stockByPickupPoint.productId);

  for (const row of rows) {
    if (row.product_id === null) continue;
    byProduct[row.product_id] = Number(row.quantity);
  }
  return byProduct;
}

/**
 * Наявність модифікацій одного товару.
 *
 * 🔴 Заміна функції БД `get_stock_info`, якої в схемі v2 НЕМАЄ (baseline B13
 * не везе жодної plpgsql-функції, крім читача актора). Правило збережено
 * дослівно: доступно, якщо є залишок АБО статус — «під замовлення».
 */
export async function loadModificationStock(
  db: ActorDb,
  modificationIds: string[],
): Promise<Record<string, ModificationStockRow>> {
  const stock: Record<string, ModificationStockRow> = {};
  if (modificationIds.length === 0) return stock;

  const quantities = await loadStockByModification(db, modificationIds);
  const rows = await db
    .select({
      id: productModifications.id,
      stock_status: productModifications.stockStatus,
    })
    .from(productModifications)
    .where(inArray(productModifications.id, modificationIds));

  for (const row of rows) {
    const totalQuantity = quantities[row.id] ?? 0;
    stock[row.id] = {
      totalQuantity,
      isAvailable: totalQuantity > 0 || row.stock_status === 'on_order',
    };
  }
  return stock;
}
