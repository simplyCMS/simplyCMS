import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { ADMIN_ROLES_LOCK } from 'simplycms/auth';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { advisoryXactLock } from 'simplycms/db';
import { sessions, users } from 'simplycms/schema';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';
import { isAdminUser } from './guards';

export const setCustomerBanInput = z.object({
  userId: z.uuid(),
  banned: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

/**
 * Бан/розбан покупця з картки (Е6г-4, Е6г-13), `customer.manage`.
 *
 * `admin-roles` — ПЕРШИЙ запит: «не адмін» перевіряється під ним, тож гонка
 * «видати роль ↔ забанити» не дасть забаненого адміна (дзеркало Е6г-11).
 * Бан, видалення сесій і `banned_at` — ОДНА транзакція: між ними не лишається
 * вікна, де забанений має живу сесію. Вставку нової сесії, що змагається з
 * баном, відсікає тригер БД `sessions_refuse_banned` (Е6г-14).
 */
export const setCustomerBanOp = async ({
  data,
}: {
  data: z.input<typeof setCustomerBanInput>;
}): Promise<{ bannedAt: Date | null }> => {
  const input = parseAdminInput(setCustomerBanInput, data);
  return runAdmin('customer.manage', async (db) => {
    await advisoryXactLock(db, ADMIN_ROLES_LOCK);
    if (!input.banned) {
      await db
        .update(users)
        .set({ bannedAt: null, banReason: null })
        .where(eq(users.id, input.userId));
      return { bannedAt: null };
    }
    if (await isAdminUser(db, input.userId))
      stateConflict(ADMIN_STATE_CONSTRAINT.customerIsAdmin);
    const [row] = await db
      .update(users)
      .set({ bannedAt: sql`now()`, banReason: input.reason || null })
      .where(eq(users.id, input.userId))
      .returning({ bannedAt: users.bannedAt });
    if (!row)
      throw new Error(`[admin-server] покупця ${input.userId} не існує`);
    await db.delete(sessions).where(eq(sessions.userId, input.userId));
    return { bannedAt: row.bannedAt };
  });
};
