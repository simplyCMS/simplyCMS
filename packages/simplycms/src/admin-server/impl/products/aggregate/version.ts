import { ValidationError } from 'simplycms/contracts/domain-errors';
import { isForeignKeyViolation, type ActorDb } from 'simplycms/db';
import { bumpVersion } from '../../translatable/roots';
import { PRODUCT_ROOT } from './root';
import type { ProductBase } from './schemas';

/** Версія + база кореня товару — спільний `bumpVersion` (`translatable/roots.ts`). */
export const bumpProduct = (db: ActorDb, id: string, base?: ProductBase) =>
  bumpVersion(db, PRODUCT_ROOT, id, base);

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
