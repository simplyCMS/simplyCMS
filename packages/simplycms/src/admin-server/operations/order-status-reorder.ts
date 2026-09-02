import { asc, desc, eq, gt, inArray, lt } from 'drizzle-orm';
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
 *
 * 🔴 Детермінований порядок локів (фінальне рев'ю Е1б, знахідка 1;
 * відтворено 40P01 на живому Postgres двома незалежними прогонами).
 * Стара форма локала "current → neighbor" ДВОМА окремими `FOR UPDATE`:
 * для суміжної пари (A, B) reorder(A,'down') брав A, потім B, а
 * reorder(B,'up') — у ЗУСТРІЧНОМУ порядку, B, потім A. Дві конкурентні
 * транзакції з круговим очікуванням локів = дедлок. Фікс: спершу БЕЗ
 * локів знаходимо id обох рядків (за фактичним sort_order у БД, не з
 * клієнта), потім блокуємо ОБИДВА ОДНИМ запитом `where id in (…) order
 * by id for update` — порядок локів однаковий для будь-якої пари
 * незалежно від напряму свопу, циклу очікування вже немає.
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
      const [seen] = await db
        .select()
        .from(orderStatuses)
        .where(eq(orderStatuses.id, data.id));
      if (!seen) throw new Error(`[admin-server] статусу ${data.id} не існує`);
      const [next] = await db
        .select({ id: orderStatuses.id })
        .from(orderStatuses)
        .where(
          data.direction === 'up'
            ? lt(orderStatuses.sortOrder, seen.sortOrder)
            : gt(orderStatuses.sortOrder, seen.sortOrder),
        )
        .orderBy(
          data.direction === 'up'
            ? desc(orderStatuses.sortOrder)
            : asc(orderStatuses.sortOrder),
        )
        .limit(1);
      if (!next) return { swapped: [] as (typeof seen)[] };
      // Один запит, обидва рядки, порядок за id — незалежно від того, хто
      // тут "current" і хто "neighbor" (рев'ю р2: FOR UPDATE лишається
      // потрібним — без нього overlapping-swap лишав би дубльовані
      // sort_order).
      const locked = await db
        .select()
        .from(orderStatuses)
        .where(inArray(orderStatuses.id, [data.id, next.id]))
        .orderBy(asc(orderStatuses.id))
        .for('update');
      const current = locked.find((r) => r.id === data.id);
      const neighbor = locked.find((r) => r.id === next.id);
      if (!current || !neighbor)
        throw new Error('[admin-server] рядок зник між вибіркою і локом');
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
