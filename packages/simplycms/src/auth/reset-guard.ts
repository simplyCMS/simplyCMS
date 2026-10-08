import { eq } from 'drizzle-orm';
import { withActor } from 'simplycms/db';
import { users, verifications } from 'simplycms/schema';

/** Порт guard-а скидання пароля — щоб `createAuth` тестувався без Postgres. */
export type ResetGuard = (
  userId: string,
  emailSnapshot: string,
  token: string,
) => Promise<boolean>;

/**
 * Guard `sendResetPassword` (Е6г-18). BA вставляє `reset-password:<token>`
 * окремим запитом ПЕРЕД колбеком, тож між `findUserByEmail` і колбеком
 * email міг змінитись, а акаунт — зникнути. Тут, у транзакції `app_admin`,
 * користувача читають БЕЗУМОВНИМ `FOR SHARE` (умова у `WHERE` ламає
 * блокування): він чекає незакомічену зміну/видалення й бачить свіжий рядок.
 * Рядка немає або email інший → токен видаляється, `false` (листа не шлемо).
 * Винятку назовні немає: BA і так відповідає однаково.
 */
export const isResetStillValid: ResetGuard = (userId, emailSnapshot, token) =>
  withActor({ role: 'app_admin' }, async (db) => {
    const [row] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .for('share');
    const valid =
      row !== undefined &&
      row.email.toLowerCase() === emailSnapshot.toLowerCase();
    if (!valid)
      await db
        .delete(verifications)
        .where(eq(verifications.identifier, `reset-password:${token}`));
    return valid;
  });
