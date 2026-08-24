import { productPrices } from 'simplycms/schema';
import type { PriceEntry } from 'simplycms/contracts';

/** Ціна товару/модифікації — форма `PriceEntry` домену ціноутворення. */
export const priceColumns = {
  product_id: productPrices.productId,
  price_type_id: productPrices.priceTypeId,
  price: productPrices.price,
  old_price: productPrices.oldPrice,
  modification_id: productPrices.modificationId,
};

/** Сирий рядок ціни: `numeric` приїжджає з драйвера рядком, а не числом. */
export interface RawPriceRow {
  product_id: string;
  price_type_id: string;
  price: string;
  old_price: string | null;
  modification_id: string | null;
}

/**
 * Переводить `numeric` у число доменного контракту.
 *
 * 🔴 Конверсія явна й тут, а не в рендері. `pg` віддає `numeric` РЯДКОМ (щоб
 * не втратити точність, якої немає в double), тож без цього кроку `resolvePrice`
 * повертав би рядок, а форматувальник ціни склеював би його як текст — дефект,
 * що виглядає як «ціна не відформатувалась», а не як помилка типу.
 */
export function toPriceEntry(row: RawPriceRow): PriceEntry {
  return {
    price_type_id: row.price_type_id,
    price: Number(row.price),
    old_price: row.old_price === null ? null : Number(row.old_price),
    modification_id: row.modification_id,
  };
}

/** Групує ціни за товаром — щоб один запит на список не став N+1. */
export function groupPricesByProduct(
  rows: RawPriceRow[],
): Record<string, PriceEntry[]> {
  const byProduct: Record<string, PriceEntry[]> = {};
  for (const row of rows) {
    (byProduct[row.product_id] ??= []).push(toPriceEntry(row));
  }
  return byProduct;
}
