import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { readSessionSubject } from 'simplycms/auth';
import {
  loadProductRatings,
  loadProductReviews,
  loadReviewAuthors,
  withCustomerDb,
  withStorefrontDb,
  withStoreOperatorDb,
  type ProductRating,
  type ProductReviewRow,
} from 'simplycms/storefront/loaders';

export type { ProductRating, ProductReviewRow };

/**
 * Відгуки товару, видимі тому, хто питає.
 *
 * 🔴 Актор транзакції вирішує видимість, а не параметр: анонім читає під
 * `app_user` без ідентичності й дістає лише `approved`, залогінений — під
 * власним id і дістає ще й свої `pending` (політика
 * `product_reviews_select_approved_or_own`). Приймати `userId` від клієнта
 * тут означало б віддати чужий нерозглянутий відгук на замовлення.
 *
 * Підписи авторів добираються другою транзакцією під `app_admin` — чому саме
 * так і чим обмежено, описано в `loadReviewAuthors`.
 */
export const getProductReviews = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ productId: z.string().uuid() }))
  .handler(async ({ data }): Promise<ProductReviewRow[]> => {
    const { productId } = data as { productId: string };
    const subject = await readSessionSubject(getRequest().headers);

    const reviews = subject
      ? await withCustomerDb(subject.userId, (db) =>
          loadProductReviews(db, productId),
        )
      : await withStorefrontDb((db) => loadProductReviews(db, productId));
    if (reviews.length === 0) return reviews;

    const authors = await withStoreOperatorDb((db) =>
      loadReviewAuthors(db, [...new Set(reviews.map((row) => row.user_id))]),
    );
    return reviews.map((row) => ({
      ...row,
      profile: authors[row.user_id] ?? null,
    }));
  });

/**
 * Середній рейтинг і кількість відгуків пачки товарів.
 *
 * Виклик анонімний навмисно: агрегат рахується ЛИШЕ по схвалених, тож
 * ідентичність на нього не впливає — а однаковий для всіх результат ще й
 * кешується React Query одним ключем.
 */
export const getProductRatings = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ productIds: z.array(z.string().uuid()).max(200) }))
  .handler(async ({ data }): Promise<Record<string, ProductRating>> => {
    const { productIds } = data as { productIds: string[] };
    return withStorefrontDb((db) => loadProductRatings(db, productIds));
  });
