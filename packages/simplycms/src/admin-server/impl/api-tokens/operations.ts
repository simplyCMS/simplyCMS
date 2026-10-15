import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { AuthzError } from 'simplycms/auth';
import { AdminNotFoundError } from 'simplycms/contracts/domain-errors';
import {
  defineOperation,
  generateToken,
  OPERATION_ID_FORMAT,
} from 'simplycms/operations';
import type { ActorDb } from 'simplycms/db';
import { apiTokens, serviceAccounts, users } from 'simplycms/schema';

// Керування токенами HTTP API й сервісними обліковими записами (М1, І27).
// 🔴 Усе `sessionOnly`: витеклий Bearer не випускає нових токенів. Права —
// `apiToken.manage` (Д5), не `settings.manage`.

const iso = z.iso.datetime();
const tokenView = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  tokenPrefix: z.string(),
  scopes: z.array(z.string()),
  expiresAt: iso.nullable(),
  revokedAt: iso.nullable(),
  lastUsedAt: iso.nullable(),
  createdAt: iso,
});

/**
 * Токен випускається лише для себе чи сервісного облікового запису (рядок у
 * `service_accounts`). Іншим — `AuthzError`: адмін не діє від імені іншої людини
 * (зокрема запрошеної, що ще без `accounts`), і атрибуція токена не фальсифікується.
 */
async function assertTokenOwner(
  db: ActorDb,
  actorId: string | null,
  userId: string,
) {
  if (userId === actorId) return;
  const [service] = await db
    .select({ userId: serviceAccounts.userId })
    .from(serviceAccounts)
    .where(eq(serviceAccounts.userId, userId));
  if (service) return;
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new AdminNotFoundError('користувач');
  throw new AuthzError('api-tokens.create');
}

export const apiTokensCreate = defineOperation({
  id: 'api-tokens.create',
  permission: 'apiToken.manage',
  sessionOnly: true,
  input: z.object({
    id: z.uuid(),
    userId: z.uuid(),
    name: z.string().trim().min(1).max(100),
    scopes: z.array(z.string().regex(OPERATION_ID_FORMAT)).max(200),
    expiresAt: iso.optional(),
  }),
  // Токен у відповіді ОДИН раз: у БД лишається лише хеш.
  output: z.object({ token: z.string() }),
  async run({ db, actor }, input) {
    const actorId = actor.kind === 'admin' ? actor.userId : null;
    await assertTokenOwner(db, actorId, input.userId);
    const { token, prefix, hash } = generateToken();
    await db.insert(apiTokens).values({
      id: input.id,
      userId: input.userId,
      name: input.name,
      tokenPrefix: prefix,
      tokenHash: hash,
      scopes: input.scopes,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      createdBy: actorId,
    });
    return { token };
  },
});

export const apiTokensRevoke = defineOperation({
  id: 'api-tokens.revoke',
  permission: 'apiToken.manage',
  sessionOnly: true,
  input: z.object({ id: z.uuid() }),
  output: z.object({ id: z.string() }),
  async run({ db }, input) {
    const [row] = await db
      .select({ id: apiTokens.id })
      .from(apiTokens)
      .where(eq(apiTokens.id, input.id));
    if (!row) throw new AdminNotFoundError('токен');
    // Повторне відкликання не пересуває `revoked_at` (перша мітка — правда).
    await db
      .update(apiTokens)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(apiTokens.id, input.id), isNull(apiTokens.revokedAt)));
    return { id: input.id };
  },
});

export const apiTokensList = defineOperation({
  id: 'api-tokens.list',
  permission: 'apiToken.manage',
  sessionOnly: true,
  input: z.object({}),
  output: z.array(tokenView),
  async run({ db }) {
    // Колонки явно: `token_hash` у відповідь не потрапляє за побудовою.
    const rows = await db
      .select({
        id: apiTokens.id,
        userId: apiTokens.userId,
        name: apiTokens.name,
        tokenPrefix: apiTokens.tokenPrefix,
        scopes: apiTokens.scopes,
        expiresAt: apiTokens.expiresAt,
        revokedAt: apiTokens.revokedAt,
        lastUsedAt: apiTokens.lastUsedAt,
        createdAt: apiTokens.createdAt,
      })
      .from(apiTokens)
      .orderBy(desc(apiTokens.createdAt));
    const at = (d: Date | null) => (d ? d.toISOString() : null);
    return rows.map((r) => ({
      ...r,
      expiresAt: at(r.expiresAt),
      revokedAt: at(r.revokedAt),
      lastUsedAt: at(r.lastUsedAt),
      createdAt: r.createdAt.toISOString(),
    }));
  },
});
