import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { REVIEW_SUBMIT_ERROR } from 'simplycms/contracts';
import { CodedError } from 'simplycms/contracts/domain-errors';
import {
  MAX_REVIEW_IMAGE_BYTES,
  MAX_REVIEW_IMAGES,
} from 'simplycms/domain/media';
import {
  deleteProductReview,
  requireSessionUserId,
  submitReviewWithImages,
  updateProductReviewWithImages,
  withSessionDb,
  type ReviewImageBytes,
} from 'simplycms/storefront/loaders';
import { completeMediaErasures, inspectUpload } from 'simplycms/storage';

/** Порожнє поле форми → `null`: `FormData` віддає `''`, а не відсутність. */
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === '' || v === null ? null : v),
    z.string().max(max).nullable(),
  );

/**
 * Текстові поля форми відгуку. `status` і `userId` у схемі відсутні — їх
 * задає сервер. `FormData.get` віддає рядки, тож `rating` — з коерсією.
 */
const reviewFieldsInput = z.object({
  productId: z.uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: optionalText(200),
  content: optionalText(5000),
});

const REASON_CODE = {
  unsupported_type: REVIEW_SUBMIT_ERROR.badImage,
  too_large: REVIEW_SUBMIT_ERROR.imageTooLarge,
} as const;

/** Файли форми → перевірений вміст; кидає код відмови ДО будь-якого запису. */
async function inspectImages(
  entries: FormDataEntryValue[],
): Promise<ReviewImageBytes[]> {
  if (!entries.every((e) => e instanceof File))
    throw new CodedError(REVIEW_SUBMIT_ERROR.badImage);
  if (entries.length > MAX_REVIEW_IMAGES)
    throw new CodedError(REVIEW_SUBMIT_ERROR.tooManyImages);
  const images: ReviewImageBytes[] = [];
  for (const file of entries as File[]) {
    const checked = await inspectUpload(file, MAX_REVIEW_IMAGE_BYTES);
    if (!checked.ok) throw new CodedError(REASON_CODE[checked.reason]);
    images.push({ bytes: checked.bytes, mime: checked.mime });
  }
  return images;
}

/**
 * Лишити відгук із фото від імені власника сесії — ОДИН запит (Е6д-6).
 *
 * 🔴 `userId` у вході НЕМАЄ: автора задає cookie Better Auth
 * (`requireSessionUserId`). Політика `product_reviews_insert_own` звіряє
 * рядок саме з тим актором, якого їй назвав сервер.
 *
 * 🔴 Кількість і КОЖЕН файл (сигнатура, розмір) перевіряються ДО першого
 * запису: відмова на п'ятому файлі не має лишати чотири опубліковані. Уся
 * послідовність запису — у `submitReviewWithImages`, щоб харнес ганяв
 * справжній код. Валідатор — функція: схема `FormData` не приймає.
 */
export const submitProductReview = createServerFn({ method: 'POST' })
  .validator((data: unknown): FormData => {
    if (!(data instanceof FormData)) {
      throw new Error('[simplycms] submitProductReview expects FormData.');
    }
    return data;
  })
  .handler(async ({ data }): Promise<{ id: string }> => {
    const fields = reviewFieldsInput.parse({
      productId: data.get('productId'),
      rating: data.get('rating'),
      title: data.get('title'),
      content: data.get('content'),
    });
    const images = await inspectImages(data.getAll('images'));
    const userId = await requireSessionUserId();
    return submitReviewWithImages(userId, fields, images);
  });

/** Поля правки: ті самі текстові поля, що й при подачі, плюс `id` відгуку. */
const reviewEditFieldsInput = z.object({
  id: z.uuid(),
  rating: reviewFieldsInput.shape.rating,
  title: reviewFieldsInput.shape.title,
  content: reviewFieldsInput.shape.content,
  // Референси лишених фото: рядки, не файли. Належність відгуку перевіряє
  // ядро під локом рядка, не схема.
  keep: z.array(z.string().min(1).max(512)).max(MAX_REVIEW_IMAGES),
});

/**
 * Відредагувати власний відгук (Е6д-23) — ОДИН запит, як подача: текст,
 * `keep` (лишені фото) і нові `images`. Відгук повертається на модерацію.
 *
 * 🔴 Як і в подачі: автора задає cookie, кількість і кожен файл
 * перевіряються ДО першого запису, а уся послідовність — у
 * `updateProductReviewWithImages` (харнес ганяє справжній код).
 */
export const updateProductReview = createServerFn({ method: 'POST' })
  .validator((data: unknown): FormData => {
    if (!(data instanceof FormData)) {
      throw new Error('[simplycms] updateProductReview expects FormData.');
    }
    return data;
  })
  .handler(async ({ data }): Promise<{ id: string }> => {
    const fields = reviewEditFieldsInput.parse({
      id: data.get('id'),
      rating: data.get('rating'),
      title: data.get('title'),
      content: data.get('content'),
      keep: data.getAll('keep'),
    });
    const files = await inspectImages(data.getAll('images'));
    const userId = await requireSessionUserId();
    return updateProductReviewWithImages(userId, { ...fields, files });
  });

/**
 * Видалити власний відгук; `false` — рядка немає або він чужий.
 *
 * 🔴 Файли фото стираються ПІСЛЯ COMMIT (Е6д-14): транзакція видаляє лише
 * рядки `media`, тож падіння COMMIT лишає і файли, і референси цілими, а
 * збій диска лишає рядок outbox `media_erasures` (Е6д-20).
 */
export const deleteMyProductReview = createServerFn({ method: 'POST' })
  .validator(z.object({ reviewId: z.uuid() }))
  .handler(async ({ data }): Promise<boolean> => {
    const { reviewId } = data as { reviewId: string };
    const { deleted, discard } = await withSessionDb((db, userId, operator) =>
      deleteProductReview(db, operator, userId, reviewId),
    );
    await completeMediaErasures(discard);
    return deleted;
  });
