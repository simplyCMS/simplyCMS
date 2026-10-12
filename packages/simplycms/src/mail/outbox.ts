import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, lt, notInArray, sql } from 'drizzle-orm';
import { withActor, type ActorDb } from 'simplycms/db';
import { redactUrls } from 'simplycms/env';
import { mailOutbox } from 'simplycms/schema';

import { getMailTransport } from './transport';
import type { MailMessage, MailTransport } from './types';

/** Скільки хвостів опортуністично добирає `deliverMail` (Е8-Р10). */
export const MAIL_RETRY_BATCH = 5;

/** Хвіст молодший за цей вік не чіпаємо: його власник, імовірно, ще працює. */
const OPPORTUNISTIC_MIN_AGE = sql`interval '1 minute'`;

export type MailKind =
  'password_reset' | 'owner_invite' | 'order_customer' | 'order_owner';

export type MailItem = { kind: MailKind; message: MailMessage };

/** Рядок картки хвостів: свідомо БЕЗ `message` (посилання скидання — секрет). */
export type MailOutboxRow = {
  id: string;
  kind: MailKind;
  requestedAt: Date;
  attempts: number;
  lastError: string | null;
};

/** Службова транзакція `app_admin` без `userId` (як `asService` у storage). */
function asService<T>(fn: (db: ActorDb) => Promise<T>): Promise<T> {
  return withActor({ role: 'app_admin' }, (db) => fn(db));
}

/**
 * `last_error`: маскований текст помилки, обрізаний до 500 символів. Полів
 * листа немає — драйвер може вставити адресу чи URL у повідомлення, але не
 * тіло, а userinfo з рядка підключення маскує `redactUrls`.
 */
function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return redactUrls(text).slice(0, 500);
}

/**
 * Перша фаза: лист у ТІЙ САМІЙ транзакції, що й подія, яка його породила.
 * Відкат прибирає обидва. Повертає id рядків для `deliverMail`.
 */
export async function enqueueMail(
  db: ActorDb,
  items: readonly MailItem[],
): Promise<string[]> {
  if (items.length === 0) return [];
  const ids = items.map(() => randomUUID());
  await db.insert(mailOutbox).values(
    items.map((item, i) => ({
      id: ids[i]!,
      kind: item.kind,
      message: item.message,
    })),
  );
  return ids;
}

/**
 * Постановка власною транзакцією — для листів поза транзакцією події (скидання
 * пароля, запрошення). На відміну від `scheduleMediaErasures` КИДАЄ: збій
 * запису тут — це лист, що не потрапив у чергу й зник би без сліду, а не хвіст
 * прибирання, який підбере sweep.
 */
export function scheduleMail(items: readonly MailItem[]): Promise<string[]> {
  return asService((db) => enqueueMail(db, items));
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
async function runBatch(
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

/**
 * Друга фаза: надіслати `ids` ПІСЛЯ COMMIT транзакції-власниці, далі добрати
 * до `MAIL_RETRY_BATCH` хвостів старших за хвилину (таймера немає). Не кидає:
 * це хвіст події, що вже відбулась; слід лишається в outbox.
 */
export async function deliverMail(
  ids: readonly string[],
  transport: MailTransport = getMailTransport(),
): Promise<void> {
  try {
    if (ids.length > 0)
      await runBatch(transport, { ids, limit: ids.length, minAge: false });
    await runBatch(transport, {
      exclude: ids,
      limit: MAIL_RETRY_BATCH,
      minAge: true,
    });
  } catch (error) {
    console.warn('[simplycms/mail] deliver failed', errorText(error));
  }
}

/**
 * Явний повтор (кнопка в адмінці): без обмеження за віком. На відміну від
 * `deliverMail` кидає помилку БД — оператор мусить її побачити.
 */
export function retryMail(
  limit: number = MAIL_RETRY_BATCH,
  transport: MailTransport = getMailTransport(),
): Promise<{ sent: number; failed: number }> {
  return runBatch(transport, { limit, minAge: false });
}

/** Хвости від найстаріших для картки адмінки; `message` не читається. */
export async function listMailOutbox(db: ActorDb): Promise<MailOutboxRow[]> {
  const rows = await db
    .select({
      id: mailOutbox.id,
      kind: mailOutbox.kind,
      requestedAt: mailOutbox.requestedAt,
      attempts: mailOutbox.attempts,
      lastError: mailOutbox.lastError,
    })
    .from(mailOutbox)
    .orderBy(asc(mailOutbox.requestedAt));
  return rows.map((r) => ({ ...r, kind: r.kind as MailKind }));
}
