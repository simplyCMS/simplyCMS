import { createHash, randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import {
  readSessionSubject,
  readUserRoles,
  type AuthzSubject,
} from 'simplycms/auth';
import { asService } from 'simplycms/db';
import { apiTokens, users } from 'simplycms/schema';

/** `scms_<prefix:8 hex>_<secret:43 base64url = 32 байти>`; префікс лише для UI. */
const TOKEN_FORMAT = /^scms_[0-9a-f]{8}_[A-Za-z0-9_-]{43}$/;

/** sha256 від УСЬОГО рядка токена: за ним (UNIQUE) відбувається пошук. */
export const hashToken = (token: string): Buffer =>
  createHash('sha256').update(token).digest();

/** Новий токен: секрет високоентропійний, тому швидкий sha256 без солі достатній. */
export function generateToken(): {
  token: string;
  prefix: string;
  hash: Buffer;
} {
  const prefix = randomBytes(4).toString('hex');
  const token = `scms_${prefix}_${randomBytes(32).toString('base64url')}`;
  return { token, prefix, hash: hashToken(token) };
}

/**
 * `Authorization: Bearer …` → суб'єкт токена або `'invalid'`.
 *
 * 🔴 Пошук ЛИШЕ за повним хешем, без пошуку за префіксом: час відповіді
 * невдалої автентифікації не залежить від того, чи існує токен із таким
 * префіксом. Відкликаний, прострочений токен чи забанений власник → `'invalid'`.
 * Ролі — з `user_roles` тим самим читанням, що й `readSessionSubject`.
 */
export async function subjectFromToken(
  authorization: string,
): Promise<AuthzSubject | 'invalid'> {
  const match = /^Bearer (\S+)$/i.exec(authorization.trim());
  if (!match || !TOKEN_FORMAT.test(match[1]!)) return 'invalid';
  const hash = hashToken(match[1]!);
  const row = await asService(async (db) => {
    const [found] = await db
      .select({
        id: apiTokens.id,
        userId: apiTokens.userId,
        scopes: apiTokens.scopes,
        revokedAt: apiTokens.revokedAt,
        expired: sql<boolean>`${apiTokens.expiresAt} is not null and ${apiTokens.expiresAt} <= now()`,
        banned: sql<boolean>`${users.bannedAt} is not null`,
      })
      .from(apiTokens)
      .innerJoin(users, eq(users.id, apiTokens.userId))
      .where(eq(apiTokens.tokenHash, hash));
    if (!found || found.revokedAt || found.expired || found.banned) return null;
    // Не частіше разу на хвилину на токен: інакше кожен запит API писав би в БД.
    await db
      .update(apiTokens)
      .set({ lastUsedAt: sql`now()` })
      .where(
        and(
          eq(apiTokens.id, found.id),
          sql`(${apiTokens.lastUsedAt} is null or ${apiTokens.lastUsedAt} < now() - interval '1 minute')`,
        ),
      );
    return found;
  });
  if (!row) return 'invalid';
  return {
    userId: row.userId,
    roles: await readUserRoles(row.userId),
    scopes: row.scopes,
    tokenId: row.id,
  };
}

/**
 * Суб'єкт запиту `/api/v1`: `null` = 401.
 * 🔴 Якщо `Authorization` є, cookie ігнорується НАЗАВЖДИ: невалідний Bearer не
 * падає назад на сесію (інакше клієнт із битим токеном і живим cookie діяв би
 * з правами сесії, а CSRF-виняток для Bearer став би обходом).
 */
export async function authenticateRequest(
  request: Request,
): Promise<AuthzSubject | null> {
  const authorization = request.headers.get('authorization');
  if (authorization !== null) {
    const subject = await subjectFromToken(authorization);
    return subject === 'invalid' ? null : subject;
  }
  return readSessionSubject(request.headers);
}

/** Ключ області ідемпотентності (§3.1): два токени одного користувача не ділять ключі. */
export const subjectKeyOf = (subject: AuthzSubject): string =>
  subject.tokenId ? `token:${subject.tokenId}` : `user:${subject.userId}`;
