import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { productModifications } from 'simplycms/schema';
import { runAdmin } from '../run';
import { lockCatalogTarget } from '../catalog-lock';
import { productModificationsOps } from './resource';

export const setDefaultModificationInput = z.object({ id: z.uuid() });

// 🔴 Каст на rowSchema-виведений тип (не T['$inferSelect']), той самий
// принцип, що в resource.ts: jsonb-колонка `images` без `.$type()` дає
// Drizzle `unknown`, а `unknown` не проходить серіалізовність createServerFn.
type ModificationRow = z.infer<typeof productModificationsOps.rowSchema>;

/**
 * Дефолт рівно один НА ТОВАР (індекс idx_product_modifications_single_default
 * по product_id). Порядок той самий, що в order-statuses: СПОЧАТКУ зняти з
 * інших модифікацій ЦЬОГО товару, ПОТІМ поставити — інакше 23505. Товар
 * береться з рядка модифікації, не з клієнта. Повертає ВСІ змінені рядки —
 * клієнт робить write-back без refetch.
 */
export const setDefaultModificationOp = async ({
  data,
}: {
  data: z.infer<typeof setDefaultModificationInput>;
}) =>
  runAdmin('catalog.write', async (db) => {
    const [target] = await db
      .select({ productId: productModifications.productId })
      .from(productModifications)
      .where(eq(productModifications.id, data.id));
    if (!target)
      throw new Error(`[admin-server] модифікації ${data.id} не існує`);
    // Два одночасні setDefault різних модифікацій товару інакше обидва
    // «зняли б інших» ДО коміту сусіда і впали 23505 (catalog-lock.ts).
    await lockCatalogTarget(db, `mod-default:${target.productId}`);
    const now = new Date();
    const unset = (await db
      .update(productModifications)
      .set({ isDefault: false, updatedAt: now })
      .where(
        and(
          eq(productModifications.productId, target.productId),
          eq(productModifications.isDefault, true),
          ne(productModifications.id, data.id),
        ),
      )
      .returning()) as ModificationRow[];
    const set = (await db
      .update(productModifications)
      .set({ isDefault: true, updatedAt: now })
      .where(eq(productModifications.id, data.id))
      .returning()) as ModificationRow[];
    return { rows: [...unset, ...set] };
  });
