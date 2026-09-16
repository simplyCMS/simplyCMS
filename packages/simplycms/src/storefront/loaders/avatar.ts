import { eq } from 'drizzle-orm';
import { profiles } from 'simplycms/schema';
import {
  discardMedia,
  eraseMedia,
  writeMedia,
  type MediaMime,
  type MediaStorageDriver,
} from 'simplycms/storage';
import { withCustomerDb, type ActorDb } from './db';
import type { OperatorEscalation } from './escalation';

/** Вже перевірений вміст: сніфер і ліміт відпрацювали в serverFn. */
export interface AvatarBytes {
  readonly bytes: Uint8Array;
  readonly mime: MediaMime;
}

/**
 * Сховище заміни аватара.
 *
 * 🔴 Канал ОДИН: `driver` дістається і публікації, і прибиранню орфана. Доки
 * їх було два незалежні параметри, викликач, який передав драйвер лише в
 * заміну, мовчки прибирав орфан у РЕАЛЬНИЙ `MEDIA_ROOT` замість свого
 * сховища: `discardMedia` ковтає помилку, а `local-fs.delete` вважає
 * `ENOENT` успіхом. `discardWith` лишає розбіжність можливою, але вже як
 * РІШЕННЯ — вона потрібна харнесу, де драйвер публікації навмисно зламаний
 * саме на видаленні. Порожнє поле = той самий драйвер.
 */
export interface AvatarStorageOptions {
  readonly driver?: MediaStorageDriver;
  readonly discardWith?: MediaStorageDriver;
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
 * 🔴 Холдер-обʼєкт, а не `let`: присвоєння з колбека потік керування TS не
 * бачить, тож у `catch` проста змінна звузилась би до рівно `null`, і
 * `tsc --strict` МОВЧКИ погодився б із мертвою гілкою прибирання.
 */
export async function replaceAvatar(
  userId: string,
  input: AvatarBytes,
  options: AvatarStorageOptions = {},
): Promise<{ ref: string }> {
  const published: { ref: string | null } = { ref: null };
  try {
    return await withCustomerDb(userId, (db, operator) =>
      replaceAvatarFor(db, operator, userId, input, options.driver, (ref) => {
        published.ref = ref;
      }),
    );
  } catch (error) {
    // Best-effort і НЕ маскує первинну помилку: `discardMedia` не кидає.
    if (published.ref !== null)
      await discardMedia(published.ref, options.discardWith ?? options.driver);
    throw error;
  }
}

/**
 * Кроки заміни ВСЕРЕДИНІ транзакції. Модуль-приватна навмисно (`replaceAvatar`).
 *
 * 🔴 ПОРЯДОК: старий аватар прибирається ОСТАННІМ — необоротна дія якомога
 * пізніше, одразу перед COMMIT. Якби видалення старого стояло першим,
 * будь-яка подальша відмова відкотила б РЯДОК старого, але не повернула б
 * його ФАЙЛ, і покупець лишився б із профілем, що веде в нікуди.
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
  // 🔴 Тут, а не після `return`: далі йдуть ДВА фалібельні кроки, і кидок у
  // будь-якому з них відкотить рядок, лишивши файл на диску.
  onPublished(record.ref);

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
