import { eq } from 'drizzle-orm';
import { AdminNotFoundError } from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';
import { currentPaths } from 'simplycms/addressing';
import { products } from 'simplycms/schema';
import type { TextsRow } from './schemas';
import { loadTextState, textRows } from '../../translatable/state';
import { loadChildren } from './children-read';
import { TRANSLATABLE } from 'simplycms/translations';

const SPEC = TRANSLATABLE.product;

// Замки кореня й порядок замків агрегата — `lock-order.ts` (тут реекспорт для викликачів).
export { lockProduct, lockProductForRemove } from './lock-order';

/** `products.get` (без блокування): база, тексти зі статусами полів, поточні адреси. */
export async function getProductAggregate(db: ActorDb, id: string) {
  const [row] = await db.select().from(products).where(eq(products.id, id));
  if (!row) throw new AdminNotFoundError('товар');
  const state = await loadTextState(db, SPEC, id);
  const { primary } = state;
  return {
    id,
    version: row.version,
    base: {
      sectionId: row.sectionId,
      sku: row.sku,
      isActive: row.isActive,
      isFeatured: row.isFeatured,
      hasModifications: row.hasModifications,
      stockStatus: row.stockStatus,
    },
    texts: textRows(SPEC, state) as Record<string, TextsRow>,
    paths: Object.fromEntries(await currentPaths(db, { kind: 'product', id })),
    ...(await loadChildren(db, id, primary)),
  };
}
