import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import {
  MEDIA_SWEEP_BATCH,
  MEDIA_SWEEP_MIN_AGE_HOURS,
} from 'simplycms/domain/media';
import {
  completeMediaErasures,
  eraseMediaRows,
  findMediaReferences,
} from 'simplycms/storage';
import { runAdmin } from '../run';

type Candidate = {
  storage_key: string;
  entity_type: string;
  entity_id: string;
};

/**
 * Рядки `media` старші за поріг без жодного референсу — по одному власнику
 * (`eraseMediaRows` стирає за умовою власника). `SKIP LOCKED`: рядок, який
 * хтось зараз видаляє чи стирає, пропускаємо, а не чекаємо.
 */
async function eraseUnreferenced(db: ActorDb): Promise<string[]> {
  const { rows } = await db.execute<Candidate>(
    sql`select storage_key, entity_type, entity_id::text as entity_id
          from public.media
         where created_at < now() - make_interval(hours => ${MEDIA_SWEEP_MIN_AGE_HOURS})
         order by created_at
           for update skip locked
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
 * немає. Вік — запобіжник від щойно завантаженого файлу, який форма ще не
 * зберегла. Двофазно: транзакція видаляє рядки й пише outbox, файли стирає
 * `completeMediaErasures` ПІСЛЯ COMMIT. За один запуск — не більше
 * `MEDIA_SWEEP_BATCH` кандидатів; решту добере наступний.
 */
export async function sweepUnreferencedMediaOp(): Promise<{ erased: number }> {
  const keys = await runAdmin('media.write', (db) => eraseUnreferenced(db));
  await completeMediaErasures(keys);
  return { erased: keys.length };
}
