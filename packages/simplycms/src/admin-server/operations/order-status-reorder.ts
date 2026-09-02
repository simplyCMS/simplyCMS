import { asc, desc, eq, gt, lt } from 'drizzle-orm';
import { z } from 'zod';
import { orderStatuses } from 'simplycms/schema';
import { requireGrant, dbRoleForSubject } from 'simplycms/auth';
import { withActor } from 'simplycms/db';

export const reorderInput = z.object({
  id: z.uuid(),
  direction: z.enum(['up', 'down']),
});

/**
 * Swap sort_order із сусідом — В ОДНІЙ транзакції (стара сторінка робила
 * два запити з браузера: перший пройшов/другий упав = два однакові
 * sort_order). Сусід шукається В БД за фактичним sort_order, не в
 * клієнтському кеші. Краю (немає сусіда) — no-op, повертає обидва
 * незмінені рядки порожнім масивом swap.
 */
export const reorderOrderStatusOp = async ({
  data,
}: {
  data: z.infer<typeof reorderInput>;
}) => {
  const { subject } = await requireGrant('catalog.write');
  return withActor(
    { role: dbRoleForSubject(subject), userId: subject.userId ?? undefined },
    async (db) => {
      // FOR UPDATE (рев'ю р2): конкурентні overlapping-swap без локів могли
      // б лишити дубльовані sort_order.
      const [current] = await db
        .select()
        .from(orderStatuses)
        .where(eq(orderStatuses.id, data.id))
        .for('update');
      if (!current)
        throw new Error(`[admin-server] статусу ${data.id} не існує`);
      const [neighbor] = await db
        .select()
        .from(orderStatuses)
        .where(
          data.direction === 'up'
            ? lt(orderStatuses.sortOrder, current.sortOrder)
            : gt(orderStatuses.sortOrder, current.sortOrder),
        )
        .orderBy(
          data.direction === 'up'
            ? desc(orderStatuses.sortOrder)
            : asc(orderStatuses.sortOrder),
        )
        .limit(1)
        .for('update');
      if (!neighbor) return { swapped: [] as (typeof current)[] };
      const swapped = [
        (
          await db
            .update(orderStatuses)
            .set({ sortOrder: neighbor.sortOrder })
            .where(eq(orderStatuses.id, current.id))
            .returning()
        )[0],
        (
          await db
            .update(orderStatuses)
            .set({ sortOrder: current.sortOrder })
            .where(eq(orderStatuses.id, neighbor.id))
            .returning()
        )[0],
      ];
      return { swapped };
    },
  );
};
