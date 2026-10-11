import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { media } from 'simplycms/schema';

import type { MediaStorageDriver } from './driver';
import { mediaKey, type MediaMime } from './keys';
import { enqueueMediaErasures } from './erasures';
import { getMediaDriver } from './local-fs';

export interface WriteMediaInput {
  readonly bytes: Uint8Array;
  readonly mime: MediaMime;
  /** До чого належить файл: `product` / `banner` / `section` / `avatar` / … */
  readonly entityType: string;
  /** `null` — файл ще не привʼязаний до рядка (медіатека; привʼязка — К4). */
  readonly entityId: string | null;
  readonly uploadedBy: string | null;
}

export interface MediaRecord {
  readonly id: string;
  /** Те, що лягає в колонку сутності (рішення Е2-1). */
  readonly ref: string;
  readonly sizeBytes: number;
  readonly mime: MediaMime;
}

/**
 * Записати файл і його метадані ОДНИМ актом.
 *
 * 🔴 Порядок усередині — рядок, ПОТІМ файл, і це не сваволя: `size_bytes`
 * мусить лягти в ТУ САМУ транзакцію, що й запис (§4-К4), а транзакцією тут
 * володіє викликач (`withActor`). Тож якщо запис файлу впаде — виняток
 * підніметься з цієї функції, транзакція відкотиться, і не лишиться ні
 * рядка, ні обліку.
 *
 * 🔴 Чого цей порядок НЕ закриває: успішний `put` і невдалий COMMIT після
 * нього лишають обʼєкт без рядка — орфан. ФС не бере участі в двофазному
 * коміті, тож інакше й бути не може; напрямок обрано безпечний (облік
 * НЕ рахує байти, яких ніхто не адресує), а sweep орфанів — К4.
 *
 * 🔴 `id` передається ЯВНО: `DEFAULT gen_random_uuid()` знято на всіх
 * таблицях Категорії A (К3-Е0), тож вставка без `id` дала б `23502`.
 *
 * 🔴 Дзеркального прибирання всередині НЕМАЄ, і це не пропуск: якщо
 * `driver.put` кидає, обʼєкт не опублікований (тимчасовий файл прибирає
 * `finally` драйвера), а рядок відкочує транзакція викликача. Прибирати
 * нічого. Уже ОПУБЛІКОВАНИЙ файл при подальшому збої викликач прибирає через
 * outbox: `scheduleMediaErasures` + `completeMediaErasures` (Е6д-20б).
 */
export async function writeMedia(
  db: ActorDb,
  input: WriteMediaInput,
  driver: MediaStorageDriver = getMediaDriver(),
): Promise<MediaRecord> {
  const id = randomUUID();
  const ref = mediaKey(input.mime);
  const sizeBytes = input.bytes.byteLength;

  await db.insert(media).values({
    id,
    entityType: input.entityType,
    entityId: input.entityId,
    storageKey: ref,
    sizeBytes,
    mimeType: input.mime,
    uploadedBy: input.uploadedBy,
  });

  await driver.put(ref, input.bytes);

  return { id, ref, sizeBytes, mime: input.mime };
}

/** Власник файлу: рядок `media` з цим `entity_type` і `entity_id` (Е6д-16). */
export interface MediaOwner {
  readonly entityType: string;
  /** `null` — файл медіатеки без привʼязки (адмінський upload без `entityId`). */
  readonly entityId: string | null;
}

/**
 * Перша фаза двофазного стирання (Е6д-14, КАНОН): видалити РЯДКИ `media`
 * власника в транзакції викликача й повернути ключі, які справді видалено.
 * Рядок outbox `media_erasures` ставиться тут же (Е6д-20) — відкат прибирає
 * обидва. Файли стирає викликач ПІСЛЯ COMMIT: `completeMediaErasures(keys)`.
 *
 * 🔴 Чому файл не стирається в транзакції: для кількох файлів обрив
 * `driver.delete` другого відкотив би обидва референси, а перший файл уже зник
 * би — битий референс. Тут найгірший наслідок — орфан-файл, який тримає outbox.
 *
 * 🔴 Умова власника обовʼязкова (Е6д-16), перевантаження без неї немає:
 * стирання йде за `storage_key`, тож підсунутий чужий ключ (аватар, банер
 * іншого запису) без цієї умови стер би чужий файл. Ключ без рядка власника —
 * чужий, `data:`/`https:`, уже стертий — тихо ігнорується й у результат не
 * потрапляє, тож його файл ніхто не стирає.
 *
 * `FOR UPDATE` + `ORDER BY storage_key` — щоб паралельні стирання тих самих
 * ключів не дійшли обидва до `discard` і не взяли локи в різному порядку.
 */
export async function eraseMediaRows(
  db: ActorDb,
  refs: readonly string[],
  owner: MediaOwner,
): Promise<string[]> {
  const keys = [...new Set(refs)];
  if (keys.length === 0) return [];
  const locked = await db
    .select({ id: media.id })
    .from(media)
    .where(
      and(
        inArray(media.storageKey, keys),
        eq(media.entityType, owner.entityType),
        owner.entityId === null
          ? isNull(media.entityId)
          : eq(media.entityId, owner.entityId),
      ),
    )
    .orderBy(media.storageKey)
    .for('update');
  if (locked.length === 0) return [];
  const deleted = await db
    .delete(media)
    .where(
      inArray(
        media.id,
        locked.map((r) => r.id),
      ),
    )
    .returning({ key: media.storageKey });
  const erased = deleted.map((r) => r.key).sort();
  await enqueueMediaErasures(db, erased);
  return erased;
}
