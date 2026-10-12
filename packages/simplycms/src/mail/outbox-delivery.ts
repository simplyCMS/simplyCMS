import { and, asc, eq, inArray, lt, notInArray, sql } from 'drizzle-orm';
import { withActor, type ActorDb } from 'simplycms/db';
import { redactUrls } from 'simplycms/env';
import { mailOutbox } from 'simplycms/schema';

import type { MailMessage, MailTransport } from './types';

/** Хвіст молодший за цей вік не чіпаємо: його власник, імовірно, ще працює. */
const OPPORTUNISTIC_MIN_AGE = sql`interval '1 minute'`;

/** Службова транзакція `app_admin` без `userId` (як `asService` у storage). */
export function asService<T>(fn: (db: ActorDb) => Promise<T>): Promise<T> {
  return withActor({ role: 'app_admin' }, (db) => fn(db));
}

/** Локальна частина без `*`, щоб не чіпати вже замасковане `scheme://***@host`. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * `last_error`: маскований текст помилки, обрізаний до 500 символів. Полів
 * листа немає, але драйвер може вставити в повідомлення адресу отримувача або
 * URL: userinfo з рядка підключення маскує `redactUrls`, а email-подібні
 * рядки (персональні дані, які в картці адмінки зайві) стають `<email>`.
 */
export function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return redactUrls(text).replace(EMAIL_RE, '<email>').slice(0, 500);
}

type Claimed = { id: string; message: MailMessage };
type Outcome = { id: string; error: string | null };

/** Крок 1: вибрати `FOR UPDATE SKIP LOCKED` і «забронювати» `requested_at`. */
function claim(opts: {
  ids?: readonly string[];
  exclude?: readonly string[];
  limit: number;
  minAge: boolean;
}): Promise<Claimed[]> {
  return asService(async (db) => {
    const conditions = [
      opts.ids ? inArray(mailOutbox.id, [...opts.ids]) : undefined,
      opts.exclude && opts.exclude.length > 0
        ? notInArray(mailOutbox.id, [...opts.exclude])
        : undefined,
      opts.minAge
        ? lt(mailOutbox.requestedAt, sql`now() - ${OPPORTUNISTIC_MIN_AGE}`)
        : undefined,
    ].filter((c) => c !== undefined);
    const rows = await db
      .select({ id: mailOutbox.id, message: mailOutbox.message })
      .from(mailOutbox)
      .where(and(...conditions))
      .orderBy(asc(mailOutbox.requestedAt))
      .limit(opts.limit)
      .for('update', { skipLocked: true });
    if (rows.length > 0)
      await db
        .update(mailOutbox)
        .set({ requestedAt: sql`now()` })
        .where(
          inArray(
            mailOutbox.id,
            rows.map((r) => r.id),
          ),
        );
    return rows.map((r) => ({ id: r.id, message: r.message as MailMessage }));
  });
}

/** Крок 3: успіх знімає рядок, збій рахує спробу. */
async function settle(outcomes: readonly Outcome[]): Promise<void> {
  if (outcomes.length === 0) return;
  await asService(async (db) => {
    const ok = outcomes.filter((o) => o.error === null).map((o) => o.id);
    if (ok.length > 0)
      await db.delete(mailOutbox).where(inArray(mailOutbox.id, ok));
    for (const o of outcomes)
      if (o.error !== null)
        await db
          .update(mailOutbox)
          .set({
            attempts: sql`${mailOutbox.attempts} + 1`,
            lastError: o.error,
          })
          .where(eq(mailOutbox.id, o.id));
  });
}

/**
 * Три кроки БЕЗ локу на час мережі (дзеркало `processTail` зі storage):
 * бронь → `transport.send` поза транзакцією → `settle`. Якщо процес помре
 * між 1 і 3, рядок лишається й його добере наступний виклик.
 */
export async function runBatch(
  transport: MailTransport,
  opts: Parameters<typeof claim>[0],
): Promise<{ sent: number; failed: number }> {
  const rows = await claim(opts);
  const outcomes: Outcome[] = [];
  for (const row of rows) {
    try {
      await transport.send(row.message);
      outcomes.push({ id: row.id, error: null });
    } catch (error) {
      outcomes.push({ id: row.id, error: errorText(error) });
    }
  }
  await settle(outcomes);
  const failed = outcomes.filter((o) => o.error !== null).length;
  return { sent: outcomes.length - failed, failed };
}
