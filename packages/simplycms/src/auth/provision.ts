import { sql } from 'drizzle-orm';
import { withActor } from 'simplycms/db';
import { profiles, userRoles } from 'simplycms/schema';
import type { ProvisionUser } from './hooks';

/**
 * Реалізація порту провізії на Postgres (Task 7, В2-К1а).
 *
 * Роль — `app_admin`: політики `profiles_admin_all` і `user_roles_admin_all`
 * дозволяють запис саме їй, а покупець свій профіль лише читає й редагує
 * (0002_grants.sql, §4). Це той самий вузький auth-шлях, що й у
 * `./drizzle-proxy`.
 */
export const provisionUserInDb: ProvisionUser = async (plan) => {
  await withActor({ role: 'app_admin' }, async (db) => {
    await db.insert(profiles).values({
      userId: plan.userId,
      email: plan.email,
      firstName: plan.firstName,
      lastName: plan.lastName,
      // 🔴 Підзапитом, а не окремим SELECT: категорія за замовчуванням
      // читається В ТІЙ САМІЙ транзакції, тож між читанням і записом ніхто
      // не встигне перемкнути прапорець `is_default`.
      categoryId: sql`(select id from public.user_categories where is_default limit 1)`,
    });

    // `onConflictDoNothing` — повторна провізія (ретрай хука після мережевого
    // збою) не має падати на унікальності `(user_id, role)`.
    await db
      .insert(userRoles)
      .values({ userId: plan.userId, role: plan.role })
      .onConflictDoNothing();
  });
};
