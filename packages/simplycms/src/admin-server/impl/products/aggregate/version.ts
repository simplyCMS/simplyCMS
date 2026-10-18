import { eq, sql } from 'drizzle-orm';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import { isForeignKeyViolation, type ActorDb } from 'simplycms/db';
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

/**
 * 23503 САМЕ FK розділу → 400 на полі `sectionId`: розділ видалили паралельно або id вигадано
 * (прямий виклик HTTP API). Інакше загальний фолбек дав би 409 `reference` із сирим іменем
 * обмеження. Попередня перевірка `FOR KEY SHARE` розділу тут гірша: команда вже тримає корінь,
 * а каскад `SET NULL` видалення розділу бере рядки товарів — зустрічний порядок (40P01).
 */
export async function withSectionRef<T>(
  path: readonly string[],
  write: () => Promise<T>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isForeignKeyViolation(error, 'products_section_id_fkey'))
      throw new ValidationError([{ path, code: 'invalid_value' }]);
    throw error;
  }
}
