import { createServerFn } from '@tanstack/react-start';
import { AVATAR_ERROR, CodedError } from 'simplycms/contracts/domain-errors';
import {
  MAX_AVATAR_BYTES,
  MEDIA_URL_BASE,
  resolveMediaUrl,
} from 'simplycms/domain/media';
import {
  clearAvatarFor,
  replaceAvatar,
  requireSessionUserId,
  withSessionDb,
} from 'simplycms/storefront/loaders';
import { completeMediaErasures, inspectUpload } from 'simplycms/storage';

const REASON_CODE = {
  unsupported_type: AVATAR_ERROR.badFormat,
  too_large: AVATAR_ERROR.tooLarge,
} as const;

/**
 * Завантажити аватар власника сесії.
 *
 * 🔴 `userId` у вході НЕМАЄ — він завжди з cookie Better Auth
 * (`requireSessionUserId`). Прийнятий від клієнта дав би змогу переписати чужий
 * профіль, і RLS не врятувала б: вона звіряє рядки саме з тим актором, якого
 * їй назвали.
 *
 * 🔴 Роль цього модуля — МЕЖОВА, і лише вона: розібрати `FormData`, кликнути
 * спільний `inspectUpload` і перекласти його `reason` у код для клієнта. Уся
 * послідовність — у `replaceAvatar` (`storefront/loaders`), щоб харнес ганяв
 * справжній код, а не копію.
 *
 * 🔴 Валідатор — функція, а не Zod-схема: `validator` зі схемою не
 * приймає `FormData` (Start типізує цю гілку окремо).
 */
export const uploadMyAvatar = createServerFn({ method: 'POST' })
  .validator((data: unknown): FormData => {
    if (!(data instanceof FormData)) {
      throw new Error('[simplycms] uploadMyAvatar expects FormData.');
    }
    return data;
  })
  .handler(async ({ data }): Promise<{ url: string }> => {
    const file = data.get('file');
    if (!(file instanceof File)) throw new CodedError(AVATAR_ERROR.badFormat);

    const checked = await inspectUpload(file, MAX_AVATAR_BYTES);
    if (!checked.ok) throw new CodedError(REASON_CODE[checked.reason]);

    // 🔴 `replaceAvatar` відкриває транзакцію САМА і сама ж прибирає орфана:
    // вікно «файл уже на диску, транзакція ще може впасти» закривається лише
    // на COMMIT, тож зібрати цю послідовність тут із кроків неможливо — вони
    // з лоадерів більше не виходять. Тут лишається тільки id власника сесії.
    const userId = await requireSessionUserId();
    const { ref } = await replaceAvatar(userId, {
      bytes: checked.bytes,
      mime: checked.mime,
    });

    const url = resolveMediaUrl(ref, MEDIA_URL_BASE);
    // Недосяжно: `mediaKey` не породжує порожнього референсу. Кидок замість
    // `!` тримає межу чесною — тип звужується доказом, а не обіцянкою.
    if (url === null) throw new CodedError(AVATAR_ERROR.badFormat);
    return { url };
  });

/** Прибрати аватар власника сесії. */
export const removeMyAvatar = createServerFn({ method: 'POST' }).handler(
  async (): Promise<void> => {
    const erased = await withSessionDb((db, userId, operator) =>
      clearAvatarFor(db, operator, userId),
    );
    // Файл — після COMMIT (Е6д-14); не кидає, хвіст лишається в outbox.
    await completeMediaErasures(erased);
  },
);
