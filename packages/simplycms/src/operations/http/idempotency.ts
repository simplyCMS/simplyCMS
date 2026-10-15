import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { pgErrorInfo, type ActorDb } from 'simplycms/db';
import type { IdempotencyRequest } from '../define';
import { ProblemError } from './problem';

/** Скільки чекає дубль на незакомічений рядок першої транзакції (К5). */
export const IDEMPOTENCY_LOCK_TIMEOUT_MS = 5000;
/** Строк життя ключа; старіший рядок ігнорується й прибирається. */
export const IDEMPOTENCY_TTL_HOURS = 24;
/** Порція протухлих рядків, що прибирається разом із кожним записом. */
export const IDEMPOTENCY_PRUNE_BATCH = 100;

/** `lock_not_available`: `lock_timeout` вичерпано. */
const LOCK_NOT_AVAILABLE = '55P03';

export type ReserveResult =
  | { readonly kind: 'fresh' }
  | { readonly kind: 'replay'; readonly status: number; readonly body: unknown }
  | { readonly kind: 'mismatch' };

type Req = IdempotencyRequest & { readonly operation: string };

/** sha256 канонічного JSON (ключі об'єктів відсортовано) — відбиток тіла запиту. */
export function fingerprintOf(body: unknown): Buffer {
  const canon = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canon)
      : v !== null && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => (a < b ? -1 : 1))
              .map(([k, x]) => [k, canon(x)]),
          )
        : v;
  return createHash('sha256')
    .update(JSON.stringify(canon(body ?? null)))
    .digest();
}

const PK = (r: Req) => sql`(${r.subjectKey}, ${r.operation}, ${r.key})`;
const STALE = sql.raw(
  `created_at < now() - interval '${IDEMPOTENCY_TTL_HOURS} hours'`,
);

/**
 * Резервує ключ ПЕРШОЮ дією транзакції команди (механізм К5, майстер §3.3).
 *
 * 🔴 `INSERT … ON CONFLICT DO NOTHING RETURNING`, а не перехоплення
 * `unique_violation`: після помилки Postgres абортує транзакцію. Конкурентний
 * дубль чекає на PK незакомічену вставку першого: після коміту бачить
 * збережене, після відкату (не-2xx) вставка проходить і він виконується сам.
 * Очікування обмежене `lock_timeout`, який ПІСЛЯ вставки повертається назад —
 * інакше він діяв би й на замки самої команди (advisory-замок мов).
 */
export async function reserveIdempotencyKey(
  db: ActorDb,
  req: Req,
): Promise<ReserveResult> {
  try {
    const prev = (
      await db.execute<{ v: string }>(
        sql`select current_setting('lock_timeout') as v`,
      )
    ).rows[0]!.v;
    await db.execute(
      sql`select set_config('lock_timeout', ${`${IDEMPOTENCY_LOCK_TIMEOUT_MS}ms`}, true)`,
    );
    // Те саме DELETE: порція протухлих + протухлий рядок САМОГО цього ключа
    // (інакше він конфліктував би з вставкою, а порція могла б його не взяти).
    await db.execute(sql`
      delete from public.idempotency_keys k using (
        (select subject_key, operation, key from public.idempotency_keys
          where ${STALE} limit ${IDEMPOTENCY_PRUNE_BATCH})
        union
        (select subject_key, operation, key from public.idempotency_keys
          where (subject_key, operation, key) = ${PK(req)} and ${STALE})
      ) s
      where k.subject_key = s.subject_key and k.operation = s.operation and k.key = s.key`);
    const inserted = await db.execute(sql`
      insert into public.idempotency_keys
        (subject_key, operation, key, fingerprint, status, response)
      values (${req.subjectKey}, ${req.operation}, ${req.key}, ${req.fingerprint}, 0, 'null'::jsonb)
      on conflict do nothing returning key`);
    await db.execute(sql`select set_config('lock_timeout', ${prev}, true)`);
    if (inserted.rows.length > 0) return { kind: 'fresh' };
    const stored = (
      await db.execute<{
        fingerprint: Buffer;
        status: number;
        response: unknown;
      }>(sql`
        select fingerprint, status, response from public.idempotency_keys
         where (subject_key, operation, key) = ${PK(req)}`)
    ).rows[0];
    if (!stored)
      throw new Error('[simplycms/operations] ключ ідемпотентності зник');
    if (!Buffer.from(stored.fingerprint).equals(req.fingerprint))
      return { kind: 'mismatch' };
    // status 0 = placeholder; закомічений placeholder — дефект, не штатна гілка.
    if (stored.status === 0)
      throw new Error(
        '[simplycms/operations] закомічений placeholder ідемпотентності',
      );
    return { kind: 'replay', status: stored.status, body: stored.response };
  } catch (error) {
    if (pgErrorInfo(error).code === LOCK_NOT_AVAILABLE)
      throw new ProblemError('idempotency_in_flight');
    throw error;
  }
}

/**
 * Записує відповідь 2xx `UPDATE`-ом ТОГО САМОГО рядка перед комітом. Не-2xx
 * не зберігаються: помилка відкочує транзакцію разом із рядком ключа.
 */
export async function storeIdempotentResponse(
  db: ActorDb,
  req: Req,
  status: number,
  body: unknown,
): Promise<void> {
  if (status < 200 || status > 299) return;
  await db.execute(sql`
    update public.idempotency_keys
       set status = ${status}, response = ${JSON.stringify(body)}::jsonb
     where (subject_key, operation, key) = ${PK(req)}`);
}
