import { and, count, eq } from 'drizzle-orm';
import { userRoles } from 'simplycms/schema';
import type { ActorDb } from 'simplycms/db';

/**
 * Спільні перевірки ролі адміна для `setAdminRole`, `setCustomerBan` і
 * `deleteCustomer` (Е6г-4). Викликаються ЛИШЕ під `ADMIN_ROLES_LOCK`:
 * без нього «не адмін» і «не останній» застаріли б між перевіркою і записом.
 */
export async function isAdminUser(
  db: ActorDb,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, 'admin')))
    .limit(1);
  return rows.length > 0;
}

export async function countAdmins(db: ActorDb): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(userRoles)
    .where(eq(userRoles.role, 'admin'));
  return row?.n ?? 0;
}
