import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { productReviews } from 'simplycms/schema';
import type { ActorDb } from './db';

/** Поля, які покупець заповнює у формі відгуку. */
export interface ReviewInput {
  productId: string;
  rating: number;
  title: string | null;
  content: string | null;
  images: string[];
}

/**
 * Лишити відгук від імені власника сесії.
 *
 * 🔴 `status` завжди `'pending'` і НЕ приходить із форми: інакше покупець
 * опублікував би собі схвалений відгук повз модерацію. `user_id` так само
 * задає сервер — політика `product_reviews_insert_own` звіряє рядок саме з
 * тим актором, якого їй назвали.
 */
export async function insertProductReview(
  db: ActorDb,
  userId: string,
  input: ReviewInput,
): Promise<void> {
  await db.insert(productReviews).values({
    id: randomUUID(),
    productId: input.productId,
    userId,
    rating: input.rating,
    title: input.title,
    content: input.content,
    images: input.images,
    status: 'pending',
  });
}

/**
 * Видалити власний відгук; `false` — рядка немає або він чужий.
 *
 * Предикат `user_id` дублює політику `product_reviews_delete_own` — і саме
 * тому `returning` порожній на чужому рядку, а виклик відповідає відмовою
 * замість тихого «успіху».
 */
export async function deleteProductReview(
  db: ActorDb,
  userId: string,
  reviewId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(productReviews)
    .where(
      and(eq(productReviews.id, reviewId), eq(productReviews.userId, userId)),
    )
    .returning({ id: productReviews.id });

  return deleted.length > 0;
}
