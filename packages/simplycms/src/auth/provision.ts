import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { withActor, type ActorDb } from 'simplycms/db';
import { profiles, userRoles, users } from 'simplycms/schema';
import {
  buildUserProvision,
  type EnsureProvisioned,
  type ProvisionUser,
  type UserProvisionPlan,
} from './hooks';

/**
 * Реалізація порту провізії на Postgres (Task 7, В2-К1а).
 *
 * Роль — `app_admin`: політики `profiles_admin_all` і `user_roles_admin_all`
 * дозволяють запис саме їй, а покупець свій профіль лише читає й редагує
 * (0002_grants.sql, §4). Це той самий вузький auth-шлях, що й у
 * `./drizzle-proxy`.
 */
async function writeProvision(
  db: ActorDb,
  plan: UserProvisionPlan,
): Promise<void> {
  // `onConflictDoNothing`: повторна провізія (ретрай хука, самовідновлення при вході) не
  // перезаписує жодного наявного рядка й не падає на унікальності `user_id`.
  await db
    .insert(profiles)
    .values({
      id: randomUUID(),
      userId: plan.userId,
      email: plan.email,
      firstName: plan.firstName,
      lastName: plan.lastName,
      // 🔴 Підзапитом, а не окремим SELECT: категорія за замовчуванням
      // читається В ТІЙ САМІЙ транзакції, тож між читанням і записом ніхто
      // не встигне перемкнути прапорець `is_default`.
      categoryId: sql`(select id from public.user_categories where is_default limit 1)`,
    })
    .onConflictDoNothing();

  // Роль — лише якщо немає ЖОДНОЇ: адмін ніколи не отримує другу роль `user`.
  const [anyRole] = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(eq(userRoles.userId, plan.userId))
    .limit(1);
  if (!anyRole)
    await db
      .insert(userRoles)
      .values({ id: randomUUID(), userId: plan.userId, role: plan.role })
      .onConflictDoNothing();
}

export const provisionUserInDb: ProvisionUser = (plan) =>
  withActor({ role: 'app_admin' }, (db) => writeProvision(db, plan));

/**
 * Провізія при вході (самовідновлення): користувач без профілю чи без ролей добудовується
 * ТИМ САМИМ планом і записом, що й при створенні — дефолтів у двох копіях немає. Наявні
 * рядки не чіпаються.
 */
export const ensureUserProvisionedInDb: EnsureProvisioned = (userId) =>
  withActor({ role: 'app_admin' }, async (db) => {
    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return;
    await writeProvision(db, buildUserProvision(user));
  });
