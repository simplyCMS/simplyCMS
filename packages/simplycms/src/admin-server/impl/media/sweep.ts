import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import {
  MEDIA_SWEEP_BATCH,
  MEDIA_SWEEP_MAX_BATCHES,
  MEDIA_SWEEP_MIN_AGE_HOURS,
} from 'simplycms/domain/media';
import {
  completeMediaErasures,
  eraseMediaRows,
  findMediaReferences,
  mediaReferenceExists,
} from 'simplycms/storage';
import { runAdmin } from '../run';

type Candidate = {
  storage_key: string;
  entity_type: string;
  entity_id: string;
};

/**
 * Один пакет: кандидати вибираються вже неприв’язаними (`not exists` з
 * спільного білдера), інакше живі старі файли займали б усе вікно `limit` і
 * сироти за ними були б недосяжні. Повторна перевірка `findMediaReferences` —
 * страховка від гонки між вибором і стиранням. `SKIP LOCKED`: рядок, який
 * хтось зараз видаляє, пропускаємо.
 */
async function eraseBatch(db: ActorDb): Promise<string[]> {
  const { rows } = await db.execute<Candidate>(
    sql`select m.storage_key, m.entity_type, m.entity_id::text as entity_id
          from public.media m
         where m.created_at < now() - make_interval(hours => ${MEDIA_SWEEP_MIN_AGE_HOURS})
           and not (${mediaReferenceExists(sql`m.storage_key`)})
         order by m.created_at
           for update of m skip locked
         limit ${MEDIA_SWEEP_BATCH}`,
  );
  const erased: string[] = [];
  for (const row of rows) {
    if ((await findMediaReferences(db, row.storage_key)).length > 0) continue;
    erased.push(
      ...(await eraseMediaRows(db, [row.storage_key], {
        entityType: row.entity_type,
        entityId: row.entity_id,
      })),
    );
  }
  return erased;
}

/**
 * Прибрати неприв’язані файли (Е6д-22): адмін-операція, фонового шедулера
 * немає. Вік — запобіжник від щойно завантаженого файлу. Кожен пакет — своя
 * коротка транзакція (локи живуть недовго), файли стирає
 * `completeMediaErasures` ПІСЛЯ її COMMIT. Не більше `MEDIA_SWEEP_MAX_BATCHES`
 * пакетів за виклик.
 */
export async function sweepUnreferencedMediaOp(): Promise<{ erased: number }> {
  let total = 0;
  for (let i = 0; i < MEDIA_SWEEP_MAX_BATCHES; i++) {
    const keys = await runAdmin('media.write', (db) => eraseBatch(db));
    await completeMediaErasures(keys);
    total += keys.length;
    if (keys.length === 0) break;
  }
  return { erased: total };
}
