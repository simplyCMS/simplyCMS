import { eq } from 'drizzle-orm';
import { profiles } from 'simplycms/schema';
import {
  discardMedia,
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

/** Опції заміни аватара. */
export interface ReplaceAvatarOptions {
  readonly driver?: MediaStorageDriver;
  /**
   * Кличеться ОДРАЗУ після публікації файлу — до `update profiles` і до
   * прибирання старого.
   *
   * 🔴 Не «зайвий гачок», а єдиний спосіб віддати викликачу референс у
   * момент, коли обʼєкт уже НЕОБОРОТНО на диску, а транзакція ще може впасти.
   * Значення, повернене з функції, приходить лише після УСПІХУ — тобто вікно
   * між `driver.put` і COMMIT (падіння `update profiles` чи `eraseMedia`
   * старого) лишалося б без прибирання, і файл ставав орфаном. Саме цей
   * дефект жив у `uploadMyAvatar` до 2026-09-13.
   */
  readonly onPublished?: (ref: string) => void;
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
  options: ReplaceAvatarOptions = {},
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
    options.driver,
  );
  // 🔴 Тут, а не після `return`: далі йдуть ДВА фалібельні кроки, і кидок у
  // будь-якому з них відкотить рядок, лишивши файл на диску.
  options.onPublished?.(record.ref);

  await db
    .update(profiles)
    .set({ avatarUrl: record.ref })
    .where(eq(profiles.userId, userId));

  if (previous)
    await operator((tx) => eraseMedia(tx, previous, options.driver));

  return { ref: record.ref };
}

/**
 * Прогнати заміну аватара так, щоб опублікований файл не пережив відкоту.
 *
 * 🔴 Живе в лоадерах, а не в serverFn, з тієї самої причини, що й
 * `replaceAvatarFor`: харнес мусить ганяти СПРАВЖНЄ прибирання, а не свою
 * копію (патерн P1 — гейт обіцяє більше, ніж перевіряє).
 *
 * 🔴 Холдер-обʼєкт, а не `let written: string | null`: присвоєння з колбека
 * потік керування TS не бачить, тож у `catch` проста змінна звужується до
 * рівно `null`, і `tsc --strict` МОВЧКИ погоджується з мертвою гілкою
 * прибирання. Компілятор тут не ловить дефект, а маскує його.
 */
export async function withAvatarOrphanCleanup<T>(
  runInTx: (onPublished: (ref: string) => void) => Promise<T>,
  driver?: MediaStorageDriver,
): Promise<T> {
  const published: { ref: string | null } = { ref: null };
  try {
    return await runInTx((ref) => {
      published.ref = ref;
    });
  } catch (error) {
    // Best-effort і НЕ маскує первинну помилку: `discardMedia` не кидає.
    if (published.ref !== null) await discardMedia(published.ref, driver);
    throw error;
  }
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
