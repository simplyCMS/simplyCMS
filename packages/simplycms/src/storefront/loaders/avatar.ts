import { eq } from 'drizzle-orm';
import { profiles } from 'simplycms/schema';
import {
  eraseMedia,
  writeMedia,
  type MediaMime,
  type MediaStorageDriver,
} from 'simplycms/storage';
import type { ActorDb } from './db';
import type { OperatorEscalation } from './escalation';

/** Вже перевірений вміст: сніфер і ліміт відпрацювали в serverFn. */
export interface AvatarBytes {
  readonly bytes: Uint8Array;
  readonly mime: MediaMime;
}

/** Поточний референс аватара покупця або `null`. */
async function currentAvatarRef(
  db: ActorDb,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row?.avatarUrl ?? null;
}

/**
 * Замінити аватар власника сесії: новий файл, новий рядок `media`,
 * оновлений профіль, прибраний старий.
 *
 * 🔴 Функція ЧИСТА щодо транзакції — `db` і `operator` приходять параметрами.
 * Саме тому харнес може прогнати справжню послідовність, а не свою копію
 * (патерн `placeOrderFor`/`prepareCheckout`); serverFn лишається тонким.
 *
 * 🔴 ПОРЯДОК: старий аватар прибирається ОСТАННІМ, і це окреме рішення від
 * інваріанта `eraseMedia` («рядок, потім обʼєкт» — він діє ВСЕРЕДИНІ одного
 * видалення й забезпечується самою `eraseMedia`). Принцип, що обʼєднує
 * обидва: НЕОБОРОТНА дія стоїть якомога пізніше в транзакції, одразу перед
 * COMMIT, щоб вікно «необоротне вже сталось, а відкат ще можливий»
 * звужувалось до самого коміту. Якби видалення старого стояло першим, будь-яка
 * подальша відмова відкотила б РЯДОК старого аватара, але не повернула б його
 * ФАЙЛ — покупець лишився б із профілем, що посилається в нікуди.
 *
 * 🔴 Старий рядок прибирається через `operator`: `app_user` не має гранта
 * `DELETE` на `media` (`0002_grants.sql:120`), і це навмисно — саме
 * відсутність права тримає інваріант незмінності власності.
 */
export async function replaceAvatarFor(
  db: ActorDb,
  operator: OperatorEscalation,
  userId: string,
  input: AvatarBytes,
  driver?: MediaStorageDriver,
): Promise<{ ref: string }> {
  const previous = await currentAvatarRef(db, userId);

  const record = await writeMedia(
    db,
    {
      bytes: input.bytes,
      mime: input.mime,
      entityType: 'avatar',
      entityId: userId,
      uploadedBy: userId,
    },
    driver,
  );

  await db
    .update(profiles)
    .set({ avatarUrl: record.ref })
    .where(eq(profiles.userId, userId));

  if (previous) await operator((tx) => eraseMedia(tx, previous, driver));

  return { ref: record.ref };
}

/** Прибрати аватар. Ідемпотентна: без аватара — no-op. */
export async function clearAvatarFor(
  db: ActorDb,
  operator: OperatorEscalation,
  userId: string,
  driver?: MediaStorageDriver,
): Promise<void> {
  const previous = await currentAvatarRef(db, userId);
  if (!previous) return;

  await db
    .update(profiles)
    .set({ avatarUrl: null })
    .where(eq(profiles.userId, userId));
  await operator((tx) => eraseMedia(tx, previous, driver));
}
