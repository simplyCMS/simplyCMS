import { eq } from 'drizzle-orm';
import { priceTypes } from 'simplycms/schema';
import type { ActorDb } from './db';

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
