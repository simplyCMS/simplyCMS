import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { withActor } from 'simplycms/db';
import { users } from 'simplycms/schema';

/** Порт «чи забанений користувач» — щоб хук тестувався без Postgres. */
export type IsUserBanned = (userId: string) => Promise<boolean>;

/**
 * `databaseHooks.session.create.before` (Е6г-13): забанений не отримує сесії.
 *
 * 🔴 Саме `throw`, а не `return false`: `with-hooks` перетворює `false` на
 * загальну `FAILED_TO_CREATE_SESSION`, і вітрина не відрізнила б бан від
 * збою. Кинутий `APIError` проходить крізь хук і доходить до клієнта
 * кодом `BANNED` (доводить тест через реальний `auth.handler`).
 * Хук покриває й скидання пароля: воно не створює сесії, а наступний вхід
 * впирається сюди ж. Гонку «бан між хуком і вставкою» закриває тригер БД
 * `sessions_refuse_banned` (Е6г-14).
 */
export const createSessionBanHook =
  (isBanned: IsUserBanned) =>
  async (session: { userId: string }): Promise<void> => {
    if (await isBanned(session.userId)) {
      throw APIError.from('FORBIDDEN', {
        code: 'BANNED',
        message: 'Account is banned',
      });
    }
  };

/** Реалізація за замовчуванням: той самий вузький шлях `app_admin`, що й решта auth. */
export const isUserBannedInDb: IsUserBanned = (userId) =>
  withActor({ role: 'app_admin' }, async (db) => {
    const [row] = await db
      .select({ bannedAt: users.bannedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.bannedAt != null;
  });
