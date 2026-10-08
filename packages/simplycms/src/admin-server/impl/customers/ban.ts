import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { ADMIN_ROLES_LOCK } from 'simplycms/auth';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { customerCategoryLock } from 'simplycms/commerce';
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
 * Порядок локів: `customer-category:<userId>` (запис `users` — FK історії
 * категорій, Е6г-22) → `admin-roles`. «Не адмін» перевіряється під ним, тож гонка
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
    await advisoryXactLock(db, customerCategoryLock(input.userId));
    await advisoryXactLock(db, ADMIN_ROLES_LOCK);
    if (!input.banned) {
      const unbanned = await db
        .update(users)
        .set({ bannedAt: null, banReason: null })
        .where(eq(users.id, input.userId))
        .returning({ id: users.id });
      if (unbanned.length === 0)
        stateConflict(ADMIN_STATE_CONSTRAINT.customerNotFound);
      return { bannedAt: null };
    }
    if (await isAdminUser(db, input.userId))
      stateConflict(ADMIN_STATE_CONSTRAINT.customerIsAdmin);
    const [row] = await db
      .update(users)
      .set({ bannedAt: sql`now()`, banReason: input.reason || null })
      .where(eq(users.id, input.userId))
      .returning({ bannedAt: users.bannedAt });
    if (!row) stateConflict(ADMIN_STATE_CONSTRAINT.customerNotFound);
    await db.delete(sessions).where(eq(sessions.userId, input.userId));
    return { bannedAt: row.bannedAt };
  });
};
