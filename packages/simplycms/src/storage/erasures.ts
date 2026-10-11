import { randomUUID } from 'node:crypto';
import { asc, eq, inArray, lt, notInArray, and, sql } from 'drizzle-orm';
import { withActor, type ActorDb } from 'simplycms/db';
import { mediaErasures } from 'simplycms/schema';

import type { MediaStorageDriver } from './driver';
import { getMediaDriver } from './local-fs';

/** Скільки хвостів опортуністично добирає `completeMediaErasures` (Е6д-20). */
export const MEDIA_ERASURE_RETRY_BATCH = 5;

/** Хвіст молодший за цей вік не чіпаємо: його власник, імовірно, ще працює. */
const OPPORTUNISTIC_MIN_AGE = sql`interval '1 minute'`;

export interface MediaErasure {
  readonly storageKey: string;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly requestedAt: Date;
}

/**
 * Служба-актор outbox: коротка транзакція `app_admin` БЕЗ `userId`.
 *
 * 🔴 Системний актор, а не адмін-користувач (Е6д-20а): `withActor` не має
 * окремого `{ kind: 'system' }`, тож `app.user_id` лишається порожнім і дія
 * не приписується людині, чия транзакція породила хвіст. Грант на
 * `media_erasures` є лише в `app_admin`, тому роль одна.
 */
function asService<T>(fn: (db: ActorDb) => Promise<T>): Promise<T> {
  return withActor({ role: 'app_admin' }, (db) => fn(db));
}

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, 500);
}

/**
 * Перша фаза: рядки outbox у ТІЙ САМІЙ транзакції й під тією самою роллю, що
 * й `DELETE media` (`eraseMediaRows`). Відкат прибирає обидва. Ідемпотентно:
 * ключ, що вже чекає стирання, не дублюється.
 */
export async function enqueueMediaErasures(
  db: ActorDb,
  keys: readonly string[],
): Promise<void> {
  if (keys.length === 0) return;
  await db
    .insert(mediaErasures)
    .values(
      [...new Set(keys)].map((storageKey) => ({
        id: randomUUID(),
        storageKey,
      })),
    )
    .onConflictDoNothing({ target: mediaErasures.storageKey });
}

/**
 * Вставка outbox власною транзакцією — для `catch` після `writeMedia`
 * (Е6д-20б): файл опубліковано, транзакція викликача мертва, рядка `media` уже
 * немає, тож без запису про файл прибирання лишилось би «найкращою спробою».
 *
 * Не кидає: викликач вже в `catch` і мусить перекинути ПЕРВИННУ помилку.
 * Межа, що лишається: БД недоступна саме тут — файл без рядка `media` і без
 * хвоста; роздача його не віддає (Е6д-21), але в списку хвостів його нема.
 */
export async function scheduleMediaErasures(
  keys: readonly string[],
): Promise<void> {
  try {
    await asService((db) => enqueueMediaErasures(db, keys));
  } catch (error) {
    console.warn('[simplycms/storage] schedule erasure failed', keys, error);
  }
}

/** Результат `driver.delete` одного ключа: помилку тримаємо значенням. */
type Attempt = { key: string; error: string | null };

/** `driver.delete` — окремий крок від запису в БД: збій диска не мусить
 *  потрапити в `catch` запису (і навпаки). */
async function tryDelete(
  driver: MediaStorageDriver,
  key: string,
): Promise<Attempt> {
  try {
    await driver.delete(key);
    return { key, error: null };
  } catch (error) {
    return { key, error: errorText(error) };
  }
}

/** Короткий запис підсумку: успіх знімає рядок, збій рахує спробу. */
async function settle(attempts: readonly Attempt[]): Promise<void> {
  if (attempts.length === 0) return;
  await asService(async (db) => {
    const ok = attempts.filter((a) => a.error === null).map((a) => a.key);
    if (ok.length > 0)
      await db
        .delete(mediaErasures)
        .where(inArray(mediaErasures.storageKey, ok));
    for (const a of attempts)
      if (a.error !== null)
        await db
          .update(mediaErasures)
          .set({
            attempts: sql`${mediaErasures.attempts} + 1`,
            lastError: a.error,
          })
          .where(eq(mediaErasures.storageKey, a.key));
  });
}

/**
 * Опрацювати найстаріші хвости трьома кроками, БЕЗ утримання локів на час
 * мережевого `driver.delete` (завислий віддалений драйвер інакше тримав би
 * з'єднання й локи без межі):
 *  1. коротка транзакція вибирає ключі `FOR UPDATE SKIP LOCKED` і «бронює» їх
 *     `requested_at = now()` — окремої колонки `claimed_at` немає, бо бронь і
 *     так відсуває хвіст за віковий фільтр (1 хв) опортуністичного добору, тож
 *     паралельний виклик їх не бере; ціна — «вік» хвоста рахується від
 *     останньої спроби;
 *  2. `driver.delete` поза транзакцією;
 *  3. коротка транзакція `settle`.
 * Якщо процес помре між 1 і 3, рядок лишається і його добере наступний виклик.
 */
async function processTail(
  driver: MediaStorageDriver,
  opts: { limit: number; minAge: boolean; exclude: readonly string[] },
): Promise<{ done: number; failed: number }> {
  const keys = await asService(async (db) => {
    const conditions = [
      opts.minAge
        ? lt(mediaErasures.requestedAt, sql`now() - ${OPPORTUNISTIC_MIN_AGE}`)
        : undefined,
      opts.exclude.length > 0
        ? notInArray(mediaErasures.storageKey, [...opts.exclude])
        : undefined,
    ].filter((c) => c !== undefined);
    const rows = await db
      .select({ key: mediaErasures.storageKey })
      .from(mediaErasures)
      .where(and(...conditions))
      .orderBy(asc(mediaErasures.requestedAt))
      .limit(opts.limit)
      .for('update', { skipLocked: true });
    const claimed = rows.map((r) => r.key);
    if (claimed.length > 0)
      await db
        .update(mediaErasures)
        .set({ requestedAt: sql`now()` })
        .where(inArray(mediaErasures.storageKey, claimed));
    return claimed;
  });
  const attempts: Attempt[] = [];
  for (const key of keys) attempts.push(await tryDelete(driver, key));
  await settle(attempts);
  return {
    done: attempts.filter((a) => a.error === null).length,
    failed: attempts.filter((a) => a.error !== null).length,
  };
}

/**
 * Друга фаза стирання (Е6д-14/20): файли ПІСЛЯ COMMIT транзакції, що видалила
 * рядки `media`. Успіх знімає рядок outbox, збій рахує спробу й пише
 * `last_error`. Далі опортуністично добирає до `MEDIA_ERASURE_RETRY_BATCH`
 * хвостів старших за хвилину (крім щойно оброблених `keys`) — фонового
 * шедулера немає. Порожній `keys` транзакції запису не відкриває, але добір
 * хвоста лишається.
 *
 * Не кидає ніколи: це хвіст дії, що вже відбулась, і збій диска чи БД тут
 * не має маскувати її результат. Слід лишається в outbox і в `console.warn`.
 */
export async function completeMediaErasures(
  keys: readonly string[],
  driver: MediaStorageDriver = getMediaDriver(),
): Promise<void> {
  const unique = [...new Set(keys)];
  try {
    const attempts: Attempt[] = [];
    for (const key of unique) attempts.push(await tryDelete(driver, key));
    for (const a of attempts)
      if (a.error !== null)
        console.warn('[simplycms/storage] erase failed', a.key, a.error);
    await settle(attempts);
    await processTail(driver, {
      limit: MEDIA_ERASURE_RETRY_BATCH,
      minAge: true,
      exclude: unique,
    });
  } catch (error) {
    console.warn('[simplycms/storage] complete erasures failed', error);
  }
}

/**
 * Явний повтор хвостів (кнопка в адмінці): без обмеження за віком. На відміну
 * від `completeMediaErasures` кидає помилку БД — оператор мусить її побачити.
 */
export function retryMediaErasures(
  limit: number = MEDIA_ERASURE_RETRY_BATCH,
  driver: MediaStorageDriver = getMediaDriver(),
): Promise<{ done: number; failed: number }> {
  return processTail(driver, { limit, minAge: false, exclude: [] });
}

/** Хвости стирання від найстаріших — для адмінської картки. */
export async function listMediaErasures(db: ActorDb): Promise<MediaErasure[]> {
  return db
    .select({
      storageKey: mediaErasures.storageKey,
      attempts: mediaErasures.attempts,
      lastError: mediaErasures.lastError,
      requestedAt: mediaErasures.requestedAt,
    })
    .from(mediaErasures)
    .orderBy(asc(mediaErasures.requestedAt));
}
