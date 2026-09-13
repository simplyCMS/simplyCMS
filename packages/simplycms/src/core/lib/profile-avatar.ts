import { createServerFn } from '@tanstack/react-start';
import {
  MAX_AVATAR_BYTES,
  MEDIA_URL_BASE,
  resolveMediaUrl,
} from 'simplycms/domain/media';
import {
  clearAvatarFor,
  replaceAvatarFor,
  withSessionDb,
} from 'simplycms/storefront/loaders';
import { discardMedia, inspectUpload } from 'simplycms/storage';

/** Машинні коди відмов: клієнт мапить їх у рядки каталогу. */
export const AVATAR_BAD_FORMAT = 'avatar/bad-format';
export const AVATAR_TOO_LARGE = 'avatar/too-large';

const REASON_CODE = {
  unsupported_type: AVATAR_BAD_FORMAT,
  too_large: AVATAR_TOO_LARGE,
} as const;

/**
 * Завантажити аватар власника сесії.
 *
 * 🔴 `userId` у вході НЕМАЄ — він завжди з cookie Better Auth
 * (`withSessionDb`). Прийнятий від клієнта id дав би змогу переписати чужий
 * профіль, і RLS не врятувала б: вона звіряє рядки саме з тим актором, якого
 * їй назвали.
 *
 * 🔴 Роль цього модуля — МЕЖОВА, і лише вона: розібрати `FormData`, кликнути
 * спільний `inspectUpload` і перекласти його `reason` у код для клієнта. Уся
 * послідовність — у `replaceAvatarFor` (`storefront/loaders`), щоб харнес
 * ганяв справжній код, а не копію.
 *
 * 🔴 Валідатор — функція, а не Zod-схема: `inputValidator` зі схемою не
 * приймає `FormData` (Start типізує цю гілку окремо).
 */
export const uploadMyAvatar = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown): FormData => {
    if (!(data instanceof FormData)) {
      throw new Error('[simplycms] uploadMyAvatar expects FormData.');
    }
    return data;
  })
  .handler(async ({ data }): Promise<{ url: string }> => {
    const file = data.get('file');
    if (!(file instanceof File)) throw new Error(AVATAR_BAD_FORMAT);

    const checked = await inspectUpload(file, MAX_AVATAR_BYTES);
    if (!checked.ok) throw new Error(REASON_CODE[checked.reason]);

    // 🔴 `written` живе ПОЗА транзакцією: якщо вона впаде після публікації
    // файлу, rollback прибере рядок, але диск про транзакції не знає —
    // обʼєкт лишився б орфаном. `catch` нижче його прибирає.
    let written: string | null = null;
    try {
      const { ref } = await withSessionDb(async (db, userId, operator) => {
        const result = await replaceAvatarFor(db, operator, userId, {
          bytes: checked.bytes,
          mime: checked.mime,
        });
        written = result.ref;
        return result;
      });
      const url = resolveMediaUrl(ref, MEDIA_URL_BASE);
      // Недосяжно: `mediaKey` не породжує порожнього референсу. Кидок замість
      // `!` тримає межу чесною — тип звужується доказом, а не обіцянкою.
      if (url === null) throw new Error(AVATAR_BAD_FORMAT);
      return { url };
    } catch (error) {
      // Прибирання best-effort і НЕ маскує первинну помилку: `discardMedia`
      // нічого не кидає, а виняток летить далі незмінним.
      if (written) await discardMedia(written);
      throw error;
    }
  });

/** Прибрати аватар власника сесії. */
export const removeMyAvatar = createServerFn({ method: 'POST' }).handler(
  async (): Promise<void> => {
    await withSessionDb((db, userId, operator) =>
      clearAvatarFor(db, operator, userId),
    );
  },
);
