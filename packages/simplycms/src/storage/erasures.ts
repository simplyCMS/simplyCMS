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

/**
 * Опрацювати найстаріші хвости: `FOR UPDATE SKIP LOCKED`, щоб два процеси не
 * стирали той самий файл. Файл стирається під локом рядка — так паралельний
 * добір його пропускає, а не дублює.
 */
async function processTail(
  driver: MediaStorageDriver,
  opts: { limit: number; minAge: boolean; exclude: readonly string[] },
): Promise<{ done: number; failed: number }> {
  return asService(async (db) => {
    const conditions = [
      opts.minAge
        ? lt(mediaErasures.requestedAt, sql`now() - ${OPPORTUNISTIC_MIN_AGE}`)
        : undefined,
      opts.exclude.length > 0
        ? notInArray(mediaErasures.storageKey, [...opts.exclude])
        : undefined,
    ].filter((c) => c !== undefined);
    const rows = await db
      .select({ id: mediaErasures.id, key: mediaErasures.storageKey })
      .from(mediaErasures)
      .where(and(...conditions))
      .orderBy(asc(mediaErasures.requestedAt))
      .limit(opts.limit)
      .for('update', { skipLocked: true });
    let done = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await driver.delete(row.key);
        await db.delete(mediaErasures).where(eq(mediaErasures.id, row.id));
        done += 1;
      } catch (error) {
        await db
          .update(mediaErasures)
          .set({
            attempts: sql`${mediaErasures.attempts} + 1`,
            lastError: errorText(error),
          })
          .where(eq(mediaErasures.id, row.id));
        failed += 1;
      }
    }
    return { done, failed };
  });
}

/**
 * Друга фаза стирання (Е6д-14/20): файли ПІСЛЯ COMMIT транзакції, що видалила
 * рядки `media`. Успіх знімає рядок outbox, збій рахує спробу й пише
 * `last_error`. Далі опортуністично добирає до `MEDIA_ERASURE_RETRY_BATCH`
 * хвостів старших за хвилину — фонового шедулера немає.
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
    const ok: string[] = [];
    const failed: { key: string; error: string }[] = [];
    for (const key of unique) {
      try {
        await driver.delete(key);
        ok.push(key);
      } catch (error) {
        failed.push({ key, error: errorText(error) });
      }
    }
    await asService(async (db) => {
      if (ok.length > 0)
        await db
          .delete(mediaErasures)
          .where(inArray(mediaErasures.storageKey, ok));
      for (const f of failed)
        await db
          .update(mediaErasures)
          .set({
            attempts: sql`${mediaErasures.attempts} + 1`,
            lastError: f.error,
          })
          .where(eq(mediaErasures.storageKey, f.key));
    });
    for (const f of failed)
      console.warn('[simplycms/storage] erase failed', f.key, f.error);
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
