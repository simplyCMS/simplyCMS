import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { advisoryXactLock, withActor } from 'simplycms/db';
import {
  serviceAccounts,
  userRoles,
  users,
  verifications,
} from 'simplycms/schema';
import type { OwnerInviteStore } from './invite';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';

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

  async issueAdminInvite({ userId, identifier, valueHash, expiresAt }) {
    return withActor({ role: 'app_admin' }, async (db) => {
      // Лок ПЕРШИМ запитом: серіалізує invite з видачею/зняттям ролі, баном
      // і видаленням покупця (Е6г-4/Е6г-19). Роль тут НЕ видається (Р19) —
      // лок і перевірка бану лишаються, щоб забанений не отримав токена.
      await advisoryXactLock(db, LOCK_KEYS.adminRoles);
      // Безумовний `FOR SHARE` за id (умова в WHERE ламає блокування), а
      // значення бану перевіряємо після читання.
      const [user] = await db
        .select({ bannedAt: users.bannedAt })
        .from(users)
        .where(eq(users.id, userId))
        .for('share');
      if (user?.bannedAt) return 'banned' as const;
      // Сервісний запис не запрошується: пошта «зайнята» (облікових даних входу
      // йому тригер БД не дозволить, тож токен був би марним і оманливим).
      const [service] = await db
        .select({ userId: serviceAccounts.userId })
        .from(serviceAccounts)
        .where(eq(serviceAccounts.userId, userId));
      if (service) return 'service' as const;
      // Старий токен тієї ж пошти знищується: «надішли ще раз» мусить робити
      // попереднє посилання недійсним, інакше в обігу живуть два ключі.
      await db
        .delete(verifications)
        .where(eq(verifications.identifier, identifier));
      await db
        .insert(verifications)
        .values({ identifier, value: valueHash, expiresAt });
      return 'issued' as const;
    });
  },

  async grantAdminRole({ userId }) {
    return withActor({ role: 'app_admin' }, async (db) => {
      // Той самий інваріант, що раніше жив у `issueAdminInvite`: лок першим
      // запитом (`FOR SHARE` не бачить незакоміченої ролі конкурента), далі
      // `FOR SHARE` на користувача й перевірка бану — забанений адміном не
      // стає (Е6г-4/Е6г-19).
      await advisoryXactLock(db, LOCK_KEYS.adminRoles);
      const [user] = await db
        .select({ bannedAt: users.bannedAt })
        .from(users)
        .where(eq(users.id, userId))
        .for('share');
      if (!user || user.bannedAt) return 'banned' as const;
      await db
        .insert(userRoles)
        .values({ id: randomUUID(), userId, role: 'admin' })
        .onConflictDoNothing({
          target: [userRoles.userId, userRoles.role],
        });
      return 'granted' as const;
    });
  },

  async isEmailVerified(userId) {
    return withActor({ role: 'app_admin' }, async (db) => {
      const rows = await db
        .select({ verified: users.emailVerified })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      return rows[0]?.verified ?? false;
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
};
