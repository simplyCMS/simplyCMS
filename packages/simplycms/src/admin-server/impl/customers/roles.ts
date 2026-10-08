import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ADMIN_ROLES_LOCK } from 'simplycms/auth';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { advisoryXactLock } from 'simplycms/db';
import { userRoles, users } from 'simplycms/schema';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';
import { countAdmins, isAdminUser } from './guards';

export const setAdminRoleInput = z.object({
  userId: z.uuid(),
  admin: z.boolean(),
});

/**
 * Видача/зняття ролі `admin` з картки покупця (Е6г-4, Е6г-11), `user.role.assign`.
 *
 * `admin-roles` — ПЕРШИЙ запит: усі перевірки нижче («не я», «не останній»,
 * «не забанений») виконуються під ним, тому два адміни, що знімають роль один
 * з одного, серіалізуються і рівно одне зняття проходить. Повтор того самого
 * стану — no-op без помилки. Рядок ролі `user` не чіпається.
 * Дію вмикає/вимикає НАСТУПНИЙ запит: ролі не лежать у токені сесії (Е6г-3).
 */
export const setAdminRoleOp = async ({
  data,
}: {
  data: z.input<typeof setAdminRoleInput>;
}): Promise<{ isAdmin: boolean }> => {
  const input = parseAdminInput(setAdminRoleInput, data);
  return runAdmin('user.role.assign', async (db, grant) => {
    await advisoryXactLock(db, ADMIN_ROLES_LOCK);
    if (input.admin) {
      // Безумовний FOR SHARE за id; значення бану — після читання.
      const [user] = await db
        .select({ bannedAt: users.bannedAt })
        .from(users)
        .where(eq(users.id, input.userId))
        .for('share');
      if (user?.bannedAt) stateConflict(ADMIN_STATE_CONSTRAINT.adminRoleBanned);
      await db
        .insert(userRoles)
        .values({ id: randomUUID(), userId: input.userId, role: 'admin' })
        .onConflictDoNothing({ target: [userRoles.userId, userRoles.role] });
      return { isAdmin: true };
    }
    if (input.userId === grant.subject.userId)
      stateConflict(ADMIN_STATE_CONSTRAINT.adminRoleSelf);
    if ((await isAdminUser(db, input.userId)) && (await countAdmins(db)) <= 1)
      stateConflict(ADMIN_STATE_CONSTRAINT.adminRoleLast);
    await db
      .delete(userRoles)
      .where(
        and(eq(userRoles.userId, input.userId), eq(userRoles.role, 'admin')),
      );
    return { isAdmin: false };
  });
};
