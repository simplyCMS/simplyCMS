import { eq, inArray } from 'drizzle-orm';
import { priceTypes, productPrices } from 'simplycms/schema';
import type { PriceEntry } from 'simplycms/contracts';
import type { ActorDb } from './db';
import { groupPricesByProduct, priceColumns } from './entities/price';

/**
 * ID типу ціни «за замовчуванням». Потрібен серверному резолву цін у списках
 * каталогу: SSR рендериться анонімно, тож ціни рахуються саме за цим типом,
 * а персональний тип покупця доклеює клієнт.
 *
 * Унікальний частковий індекс `idx_price_types_single_default` гарантує не
 * більше одного рядка, тож `limit(1)` тут — не «беремо перший-ліпший».
 */
export async function loadDefaultPriceTypeId(
  db: ActorDb,
): Promise<string | null> {
  const [row] = await db
    .select({ id: priceTypes.id })
    .from(priceTypes)
    .where(eq(priceTypes.isDefault, true))
    .limit(1);

  return row?.id ?? null;
}

/** Ціни кількох товарів одним запитом — для головної й серверного резолву позицій чекауту. */
export async function loadPricesByProduct(
  db: ActorDb,
  productIds: string[],
): Promise<Record<string, PriceEntry[]>> {
  if (productIds.length === 0) return {};
  const rows = await db
    .select(priceColumns)
    .from(productPrices)
    .where(inArray(productPrices.productId, productIds));
  return groupPricesByProduct(rows);
}
