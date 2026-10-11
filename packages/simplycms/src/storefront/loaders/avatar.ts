import { eq } from 'drizzle-orm';
import { profiles } from 'simplycms/schema';
import type { MediaOwner } from 'simplycms/storage';
import {
  completeMediaErasures,
  eraseMediaRows,
  withPublishedRollback,
  writeMedia,
  type MediaMime,
  type MediaStorageDriver,
  type MediaStorageOptions,
} from 'simplycms/storage';
import { withCustomerDb, type ActorDb } from './db';
import type { OperatorEscalation } from './escalation';

/** Вже перевірений вміст: сніфер і ліміт відпрацювали в serverFn. */
export interface AvatarBytes {
  readonly bytes: Uint8Array;
  readonly mime: MediaMime;
}

/** Власник файлу аватара: рядок `media` `avatar/<userId>` (Е6д-16). */
const avatarOwner = (userId: string): MediaOwner => ({
  entityType: 'avatar',
  entityId: userId,
});

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
 * Замінити аватар покупця: файл, рядок `media`, профіль і прибраний старий —
 * без орфана, якщо транзакція впаде.
 *
 * 🔴 ЄДИНИЙ вхід до заміни. Кроки всередині (`replaceAvatarFor`) назовні не
 * виходять: доки їх можна було покликати окремо, існував шлях БЕЗ прибирання
 * орфана — і саме ним ходив `uploadMyAvatar` до 2026-09-13.
 *
 * 🔴 `userId` параметром, транзакція своя: у serverFn id береться з cookie
 * (`requireSessionUserId`), у харнесі — від сіду; прийнятий від КЛІЄНТА
 * переписав би чужий профіль, тож ця межа лишається в serverFn.
 *
 * Відкат опублікованого файлу — `withPublishedRollback` (Е6д-20б).
 */
export async function replaceAvatar(
  userId: string,
  input: AvatarBytes,
  options: MediaStorageOptions = {},
): Promise<{ ref: string }> {
  const { ref, erased } = await withPublishedRollback(
    (track) =>
      withCustomerDb(userId, (db, operator) =>
        replaceAvatarFor(db, operator, userId, input, options.driver, track),
      ),
    options.discardWith ?? options.driver,
  );
  // Другу фазу (файл старого аватара) — ПІСЛЯ COMMIT (Е6д-14); не кидає.
  await completeMediaErasures(erased, options.driver);
  return { ref };
}

/**
 * Кроки заміни ВСЕРЕДИНІ транзакції. Модуль-приватна навмисно (`replaceAvatar`).
 *
 * 🔴 Транзакція стирає лише РЯДОК старого аватара (+ outbox); його ФАЙЛ стирає
 * `replaceAvatar` після COMMIT (Е6д-14), тож відмова транзакції файлу не чіпає.
 *
 * 🔴 Старий рядок прибирається через `operator`: `app_user` не має гранта
 * `DELETE` на `media` (`0002_grants.sql:120`) — саме відсутність права
 * тримає інваріант незмінності власності.
 *
 * 🔴 `onPublished` ОБОВʼЯЗКОВИЙ і кличеться одразу після публікації: це
 * єдиний момент, коли обʼєкт уже НЕОБОРОТНО на диску, а транзакція ще може
 * впасти (значення з `return` приходить лише після УСПІХУ).
 */
async function replaceAvatarFor(
  db: ActorDb,
  operator: OperatorEscalation,
  userId: string,
  input: AvatarBytes,
  driver: MediaStorageDriver | undefined,
  onPublished: (ref: string) => void,
): Promise<{ ref: string; erased: string[] }> {
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
  // 🔴 Тут, а не після `return`: далі йдуть ДВА фалібельні кроки, і кидок у
  // будь-якому з них відкотить рядок, лишивши файл на диску.
  onPublished(record.ref);

  await db
    .update(profiles)
    .set({ avatarUrl: record.ref })
    .where(eq(profiles.userId, userId));

  // 🔴 `operator` — це `set local role app_admin` на ТОМУ Ж зʼєднанні й тій самій
  // транзакції (`escalation.ts`), а не окреме зʼєднання, тож рядкові локи
  // `users`/`profiles` (FK-`KEY SHARE` і UPDATE вище) тут власні й самі себе не
  // блокують. Ескалація має лише стерти рядки `media`: чіпати `users`/`profiles`
  // під `app_admin` не слід (data-layer.md §13, Е6г-22; борг К3-Е6г-8).
  const erased = previous
    ? await operator((tx) =>
        eraseMediaRows(tx, [previous], avatarOwner(userId)),
      )
    : [];

  return { ref: record.ref, erased };
}

/**
 * Прибрати аватар. Ідемпотентна: без аватара — no-op. Повертає ключі, чиї
 * файли викликач стирає `completeMediaErasures` ПІСЛЯ COMMIT (Е6д-14).
 */
export async function clearAvatarFor(
  db: ActorDb,
  operator: OperatorEscalation,
  userId: string,
): Promise<string[]> {
  const previous = await currentAvatarRef(db, userId);
  if (!previous) return [];

  await db
    .update(profiles)
    .set({ avatarUrl: null })
    .where(eq(profiles.userId, userId));
  // 🔴 Те саме очікування між зʼєднаннями, що в `replaceAvatarFor` (див. там).
  return operator((tx) => eraseMediaRows(tx, [previous], avatarOwner(userId)));
}
