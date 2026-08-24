import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { readSessionSubject } from 'simplycms/auth';
import {
  deleteProductReview,
  insertProductReview,
  withCustomerDb,
  type ActorDb,
} from 'simplycms/storefront/loaders';

/** Поля форми відгуку. `status` у схемі відсутній — його задає сервер. */
const reviewInput = z.object({
  productId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).nullable(),
  content: z.string().max(5000).nullable(),
  images: z.array(z.string().url()).max(10),
});

/**
 * Лишити відгук від імені власника сесії.
 *
 * 🔴 `userId` у схемі входу НЕМАЄ: автора задає cookie Better Auth і нічого
 * більше. Політика `product_reviews_insert_own` звіряє рядок саме з тим
 * актором, якого їй назвав сервер, — прийнятий від клієнта id вона перевірити
 * не може за побудовою.
 */
export const submitProductReview = createServerFn({ method: 'POST' })
  .inputValidator(reviewInput)
  .handler(async ({ data }): Promise<void> => {
    const input = data as z.infer<typeof reviewInput>;
    await withSessionDb((db, userId) => insertProductReview(db, userId, input));
  });

/** Видалити власний відгук; `false` — рядка немає або він чужий. */
export const deleteMyProductReview = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ reviewId: z.string().uuid() }))
  .handler(async ({ data }): Promise<boolean> => {
    const { reviewId } = data as { reviewId: string };
    return withSessionDb((db, userId) =>
      deleteProductReview(db, userId, reviewId),
    );
  });

/**
 * Транзакція від імені власника сесії.
 *
 * 🔴 Дублює `storefront-routes/server/session-db#withSessionDb` свідомо:
 * тір-зони забороняють `core` (T5) імпортувати `storefront-routes` (T5), а
 * прорізати заради цього дірку в напрямку шарів дорожче, ніж повторити шість
 * рядків (той самий компроміс, що в `./user-addresses`).
 *
 * 🔴 Функція НЕ експортується: живий не-serverFn експорт утримав би
 * `simplycms/auth` і пул Postgres у клієнтському бандлі.
 */
async function withSessionDb<T>(
  fn: (db: ActorDb, userId: string) => Promise<T>,
): Promise<T> {
  const subject = await readSessionSubject(getRequest().headers);
  if (!subject) {
    // Англійською свідомо: серверна діагностика, а не рядок інтерфейсу.
    throw new Error(
      '[simplycms] Sign-in required: no session for this request.',
    );
  }
  return withCustomerDb(subject.userId, (db) => fn(db, subject.userId));
}
