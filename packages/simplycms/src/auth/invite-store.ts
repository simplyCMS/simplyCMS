import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { withActor } from 'simplycms/db';
import { userRoles, users, verifications } from 'simplycms/schema';
import type { OwnerInviteStore } from './invite';

/**
 * Сховище invite власника на Postgres (Task 7, В2-К1а).
 *
 * Роль — `app_admin`: гранти на таблиці Better Auth і на `user_roles` видані
 * саме їй (0002_grants.sql, §5-§6). Той самий вузький auth-шлях, що й у
 * `./provision`.
 */
export const ownerInviteStore: OwnerInviteStore = {
  async findUserIdByEmail(email) {
    return withActor({ role: 'app_admin' }, async (db) => {
      const rows = await db
        .select({ id: users.id })
        .from(users)
        // Пошта в БД зберігається як введена, а порівнюємо ми регістро-
        // незалежно — інакше `Owner@site` і `owner@site` дали б двох власників.
        .where(eq(sql`lower(${users.email})`, email.trim().toLowerCase()))
        .limit(1);
      return rows[0]?.id ?? null;
    });
  },

  async createUser({ email, name }) {
    return withActor({ role: 'app_admin' }, async (db) => {
      const rows = await db
        .insert(users)
        // `emailVerified: false` — власник підтвердить пошту самим фактом
        // переходу за одноразовим посиланням із листа.
        .values({ email, name, emailVerified: false })
        .returning({ id: users.id });
      return rows[0].id;
    });
  },

  async storeToken({ identifier, valueHash, expiresAt }) {
    await withActor({ role: 'app_admin' }, async (db) => {
      // Старий токен тієї ж пошти знищується: «надішли ще раз» мусить робити
      // попереднє посилання недійсним, інакше в обігу живуть два ключі.
      await db
        .delete(verifications)
        .where(eq(verifications.identifier, identifier));
      await db
        .insert(verifications)
        .values({ identifier, value: valueHash, expiresAt });
    });
  },

  async consumeToken(identifier) {
    return withActor({ role: 'app_admin' }, async (db) => {
      // DELETE … RETURNING — атомарне «прочитати й погасити» в одному
      // стейтменті: два паралельні переходи за посиланням не можуть обидва
      // побачити токен дійсним.
      const rows = await db
        .delete(verifications)
        .where(eq(verifications.identifier, identifier))
        .returning({
          valueHash: verifications.value,
          expiresAt: verifications.expiresAt,
        });
      return rows[0] ?? null;
    });
  },

  async grantAdminRole(userId) {
    await withActor({ role: 'app_admin' }, async (db) => {
      await db
        .insert(userRoles)
        .values({ id: randomUUID(), userId, role: 'admin' })
        .onConflictDoNothing({
          target: [userRoles.userId, userRoles.role],
        });
    });
  },
};

/** Чи є в магазині хоч один адмін — потрібно CLI, щоб не слати invite двічі. */
export const hasAnyAdmin = async (): Promise<boolean> =>
  withActor({ role: 'app_admin' }, async (db) => {
    const rows = await db
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(eq(userRoles.role, 'admin'))
      .limit(1);
    return rows.length > 0;
  });
