import { and, asc, desc, eq, gt, inArray, lt } from 'drizzle-orm';
import { z } from 'zod';
import { productModifications } from 'simplycms/schema';
import type { ProductModification } from 'simplycms/schema/types';
import { runAdmin } from '../run';

// 🔴 Той самий принцип, що в set-default.ts: `ProductModification` зі
// schema/types, не rowSchema-каст — jsonb-колонка `images` типізована в
// джерелі (`.$type<string[]>()`).
type ModificationRow = ProductModification;

export const reorderModificationInput = z.object({
  id: z.uuid(),
  direction: z.enum(['up', 'down']),
});

/**
 * ДОСЛІВНА адаптація order-statuses/reorder.ts (детермінований порядок
 * локів `order by id for update` — урок 40P01 Е1б), з однією зміною: сусід
 * шукається лише серед модифікацій ТОГО САМОГО товару.
 *
 * 🔴 Однакові sort_order (легасі писав індекси масиву) дають «немає
 * сусіда» для обох рядків — перестановка між ними неможлива.
 * Нормалізацію порядку дає Task 8 (новий рядок отримує max+1).
 */
export const reorderModificationOp = async ({
  data,
}: {
  data: z.infer<typeof reorderModificationInput>;
}) =>
  runAdmin('catalog.write', async (db) => {
    const [seen] = await db
      .select()
      .from(productModifications)
      .where(eq(productModifications.id, data.id));
    if (!seen)
      throw new Error(`[admin-server] модифікації ${data.id} не існує`);
    const [next] = await db
      .select({ id: productModifications.id })
      .from(productModifications)
      .where(
        and(
          eq(productModifications.productId, seen.productId),
          data.direction === 'up'
            ? lt(productModifications.sortOrder, seen.sortOrder)
            : gt(productModifications.sortOrder, seen.sortOrder),
        ),
      )
      .orderBy(
        data.direction === 'up'
          ? desc(productModifications.sortOrder)
          : asc(productModifications.sortOrder),
      )
      .limit(1);
    if (!next) return { swapped: [] as ModificationRow[] };
    const locked = await db
      .select()
      .from(productModifications)
      .where(inArray(productModifications.id, [data.id, next.id]))
      .orderBy(asc(productModifications.id))
      .for('update');
    const current = locked.find((r) => r.id === data.id);
    const neighbor = locked.find((r) => r.id === next.id);
    if (!current || !neighbor)
      throw new Error('[admin-server] рядок зник між вибіркою і локом');
    const swapped: ModificationRow[] = [
      (
        (await db
          .update(productModifications)
          .set({ sortOrder: neighbor.sortOrder })
          .where(eq(productModifications.id, current.id))
          .returning()) as ModificationRow[]
      )[0]!,
      (
        (await db
          .update(productModifications)
          .set({ sortOrder: current.sortOrder })
          .where(eq(productModifications.id, neighbor.id))
          .returning()) as ModificationRow[]
      )[0]!,
    ];
    return { swapped };
  });
