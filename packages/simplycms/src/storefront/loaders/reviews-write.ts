import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { REVIEW_SUBMIT_ERROR } from 'simplycms/contracts';
import { REVIEW_MEDIA_ENTITY } from 'simplycms/domain/media';
import { sanitizeNullableRichHtml } from 'simplycms/sanitize';
import { productReviews } from 'simplycms/schema';
import {
  discardMedia,
  eraseMediaRows,
  writeMedia,
  type MediaMime,
} from 'simplycms/storage';
import type { AvatarStorageOptions } from './avatar';
import { withCustomerDb, type ActorDb } from './db';
import type { OperatorEscalation } from './escalation';

/** Поля, які покупець заповнює у формі відгуку; `images` — референси. */
export interface ReviewInput {
  productId: string;
  rating: number;
  title: string | null;
  content: string | null;
  images: string[];
}

/**
 * Записати відгук від імені власника сесії. 🔴 `status` завжди `'pending'`
 * (не з форми — інакше відгук обійшов би модерацію), `user_id` задає сервер
 * (`product_reviews_insert_own` звіряє рядок саме з названим актором). `id`
 * передає викликач, що вже привʼязав до нього файли.
 */
export async function insertProductReview(
  db: ActorDb,
  userId: string,
  input: ReviewInput,
  id: string = randomUUID(),
): Promise<{ id: string }> {
  await db.insert(productReviews).values({
    id,
    productId: input.productId,
    userId,
    rating: input.rating,
    title: input.title,
    // 🔴 Тема 9, рубіж 1: відгук пише недовірений автор (server function можна
    // викликати напряму, повз редактор) — розмітку чистимо ДО запису.
    content: sanitizeNullableRichHtml(input.content, 'review'),
    images: input.images,
    status: 'pending',
  });
  return { id };
}

/** Вже перевірений вміст фото: сніфер і ліміт відпрацювали в serverFn. */
export interface ReviewImageBytes {
  readonly bytes: Uint8Array;
  readonly mime: MediaMime;
}

/**
 * Подати відгук разом із фото ОДНИМ актом (Е6д-6) — дзеркало `replaceAvatar`
 * (той самий канал драйвера, `discardWith` — лише для харнесу).
 *
 * 🔴 Файли публікуються до COMMIT: кожен ключ збирається одразу після
 * `writeMedia`, а `catch` ЗОВНІ транзакції прибирає їх при будь-якій відмові.
 * Повторний відгук відсікається ДО першого запису, гонку двох подач (чужої
 * незакоміченої вставки перевірка не бачить) закриває `23505` — той самий код.
 */
export async function submitReviewWithImages(
  userId: string,
  input: Omit<ReviewInput, 'images'>,
  images: readonly ReviewImageBytes[],
  options: AvatarStorageOptions = {},
): Promise<{ id: string }> {
  const published: string[] = [];
  try {
    return await withCustomerDb(userId, async (db) => {
      const id = randomUUID();
      const owner = { entityType: REVIEW_MEDIA_ENTITY, entityId: id };
      const [existing] = await db
        .select({ id: productReviews.id })
        .from(productReviews)
        .where(
          and(
            eq(productReviews.productId, input.productId),
            eq(productReviews.userId, userId),
          ),
        )
        .limit(1);
      if (existing) throw new Error(REVIEW_SUBMIT_ERROR.alreadySubmitted);
      for (const image of images) {
        const meta = { ...image, ...owner, uploadedBy: userId };
        published.push((await writeMedia(db, meta, options.driver)).ref);
      }
      const full = { ...input, images: published };
      return insertProductReview(db, userId, full, id).catch((e: unknown) => {
        throw isDuplicateReview(e)
          ? new Error(REVIEW_SUBMIT_ERROR.alreadySubmitted)
          : e;
      });
    });
  } catch (error) {
    // Best-effort і НЕ маскує первинну помилку: `discardMedia` не кидає.
    for (const ref of published)
      await discardMedia(ref, options.discardWith ?? options.driver);
    throw error;
  }
}

/** Помилка драйвера — у `.cause` Drizzle (UPSTREAM:DRZ-1, upstream-workarounds.md). */
function isDuplicateReview(error: unknown): boolean {
  const cause = ((error as { cause?: unknown })?.cause ?? error) as {
    code?: string;
    constraint?: string;
  };
  return (
    cause?.code === '23505' &&
    cause.constraint === 'product_reviews_product_id_user_id_key'
  );
}

/**
 * Видалити власний відгук; `deleted: false` — рядка немає або він чужий.
 * 🔴 `app_user` не має `DELETE` на `media` (Е6д-9, Е6д-16): рядки фото стирає
 * `operator`, і лише ключі з `RETURNING images` рядка, який ЦЯ транзакція
 * видалила як власний (не з вводу клієнта); `eraseMediaRows` ще звіряє
 * власника `review/<id>`. Файли — викликач ПІСЛЯ COMMIT (Е6д-14).
 */
export async function deleteProductReview(
  db: ActorDb,
  operator: OperatorEscalation,
  userId: string,
  reviewId: string,
): Promise<{ deleted: boolean; discard: string[] }> {
  const [row] = await db
    .delete(productReviews)
    .where(
      and(eq(productReviews.id, reviewId), eq(productReviews.userId, userId)),
    )
    .returning({ images: productReviews.images });
  if (!row) return { deleted: false, discard: [] };
  // `images` — nullable jsonb без CHECK форми: беремо лише рядки.
  const refs = Array.isArray(row.images)
    ? row.images.filter((v): v is string => typeof v === 'string')
    : [];
  const owner = { entityType: REVIEW_MEDIA_ENTITY, entityId: reviewId };
  const discard = await operator((tx) => eraseMediaRows(tx, refs, owner));
  return { deleted: true, discard };
}
