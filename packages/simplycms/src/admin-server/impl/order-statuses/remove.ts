import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { orderStatuses } from 'simplycms/schema';
import { requireGrant, dbRoleForSubject } from 'simplycms/auth';
import { withActor } from 'simplycms/db';

export const removeStatusInput = z.object({ id: z.uuid() });
export const removeManyInput = z.array(removeStatusInput).min(1).max(100);

/**
 * 🔴 remove для ЦІЄЇ сутності — іменований: «не видалити дефолтний» —
 * доменний інваріант, який частковий індекс не покриває (він забороняє
 * ДВА дефолти, не НУЛЬ), а сьогодні його тримає лише disabled-кнопка UI.
 *
 * 🔴 АТОМАРНО і без TOCTOU (рев'ю р2): один requireGrant, ОДНА
 * транзакція на весь batch; рядки беруться `FOR UPDATE` — конкурентний
 * setDefault чекає на лок і не зробить рядок дефолтним між перевіркою і
 * delete; будь-яка відмова відкочує ВЕСЬ batch — БД і оптимістичний стан
 * колекції не розходяться (TanStack DB теж відкочує транзакцію цілком).
 */
export const removeManyOrderStatusesOp = async ({
  data,
}: {
  data: z.infer<typeof removeManyInput>;
}) => {
  const { subject } = await requireGrant('catalog.write');
  return withActor(
    { role: dbRoleForSubject(subject), userId: subject.userId ?? undefined },
    async (db) => {
      const ids = data.map((d) => d.id);
      const rows = await db
        .select()
        .from(orderStatuses)
        .where(inArray(orderStatuses.id, ids))
        .for('update');
      if (rows.length !== ids.length) {
        const found = new Set(rows.map((r) => r.id));
        const missing = ids.filter((id) => !found.has(id));
        throw new Error(
          `[admin-server] статусів не існує: ${missing.join(', ')}`,
        );
      }
      const def = rows.find((r) => r.isDefault);
      if (def)
        throw new Error(
          '[admin-server] дефолтний статус видалити не можна — призначте інший дефолт',
        );
      const deleted = await db
        .delete(orderStatuses)
        .where(inArray(orderStatuses.id, ids))
        .returning();
      return { count: deleted.length };
    },
  );
};
