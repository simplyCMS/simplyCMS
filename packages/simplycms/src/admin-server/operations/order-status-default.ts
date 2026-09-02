import { eq, ne, and } from 'drizzle-orm';
import { z } from 'zod';
import { orderStatuses } from 'simplycms/schema';
import { requireGrant, dbRoleForSubject } from 'simplycms/auth';
import { withActor } from 'simplycms/db';

export const setDefaultInput = z.object({ id: z.uuid() });

/**
 * Дефолт рівно один. 🔴 Порядок під частковим unique-індексом (Task 0):
 * СПОЧАТКУ зняти з інших, ПОТІМ поставити цільовий — зворотний порядок
 * дав би два true одночасно і 23505. Вікна «нуль дефолтів» назовні немає:
 * обидва кроки в одній транзакції withActor; неіснуючий id → returning
 * порожній → throw → ROLLBACK повертає і знятий прапорець.
 */
export const setDefaultOrderStatusOp = async ({
  data,
}: {
  data: z.infer<typeof setDefaultInput>;
}) => {
  const { subject } = await requireGrant('catalog.write');
  return withActor(
    { role: dbRoleForSubject(subject), userId: subject.userId ?? undefined },
    async (db) => {
      await db
        .update(orderStatuses)
        .set({ isDefault: false })
        .where(
          and(eq(orderStatuses.isDefault, true), ne(orderStatuses.id, data.id)),
        );
      const [row] = await db
        .update(orderStatuses)
        .set({ isDefault: true })
        .where(eq(orderStatuses.id, data.id))
        .returning();
      if (!row) throw new Error(`[admin-server] статусу ${data.id} не існує`);
      return row;
    },
  );
};
