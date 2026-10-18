import { eq, sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { products } from 'simplycms/schema';
import type { ProductBase } from './schemas';

/**
 * Збільшення версії кореня + запис бази. Версія росте на КОЖНІЙ команді агрегата
 * в тій самій транзакції (майстер §3.4): тексти, адреса й фото — дочірні рядки
 * агрегата, а ETag мусить змінитися й від них.
 */
export async function bumpProduct(
  db: ActorDb,
  id: string,
  base?: ProductBase,
): Promise<number> {
  const [row] = await db
    .update(products)
    .set({
      ...base,
      version: sql`${products.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning({ version: products.version });
  return row!.version;
}
