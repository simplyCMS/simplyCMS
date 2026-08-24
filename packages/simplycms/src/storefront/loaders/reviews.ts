import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { productReviews, profiles } from 'simplycms/schema';
import type { ActorDb } from './db';

/** Автор відгуку в тому обсязі, який показує вітрина. */
export interface ReviewAuthor {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

/** Відгук у формі, яку читають картка товару й форма власного відгуку. */
export interface ProductReviewRow {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  content: string | null;
  images: string[];
  status: string;
  admin_comment: string | null;
  created_at: string;
  updated_at: string;
  profile?: ReviewAuthor | null;
}

/** Агрегат рейтингу товару — середнє й кількість ЛИШЕ схвалених відгуків. */
export interface ProductRating {
  avgRating: number;
  reviewCount: number;
}

/**
 * Відгуки товару, видимі поточному актору.
 *
 * 🔴 Звуження робить політика `product_reviews_select_approved_or_own`:
 * анонім (транзакція без `app.user_id`) бачить лише `approved`, залогінений —
 * ще й власні `pending`. Саме тому список читається під актором, а не під
 * `app_admin`: інакше несхвалений відгук поїхав би стороннім.
 */
export async function loadProductReviews(
  db: ActorDb,
  productId: string,
): Promise<ProductReviewRow[]> {
  const rows = await db
    .select()
    .from(productReviews)
    .where(eq(productReviews.productId, productId))
    .orderBy(desc(productReviews.createdAt));

  return rows.map((row) => ({
    id: row.id,
    product_id: row.productId,
    user_id: row.userId,
    rating: row.rating,
    title: row.title,
    content: row.content,
    images: Array.isArray(row.images) ? (row.images as string[]) : [],
    status: row.status,
    admin_comment: row.adminComment,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }));
}

/**
 * Підписи авторів для вже відібраних відгуків.
 *
 * 🔴 Викликається під `withStoreOperatorDb`, і це свідоме підвищення прав:
 * `profiles_select_own` не дає покупцеві бачити чужий профіль, а імена
 * авторів відгуків на вітрині публічні за задумом. Межу тримають ДВІ умови —
 * набір id закритий рядками, які актор уже законно побачив, і читаються рівно
 * три колонки підпису. Ані пошти, ані телефону, ані категорії тут немає.
 */
export async function loadReviewAuthors(
  db: ActorDb,
  userIds: string[],
): Promise<Record<string, ReviewAuthor>> {
  const authors: Record<string, ReviewAuthor> = {};
  if (userIds.length === 0) return authors;

  const rows = await db
    .select({
      user_id: profiles.userId,
      first_name: profiles.firstName,
      last_name: profiles.lastName,
      avatar_url: profiles.avatarUrl,
    })
    .from(profiles)
    .where(inArray(profiles.userId, userIds));

  for (const row of rows) {
    authors[row.user_id] = {
      first_name: row.first_name,
      last_name: row.last_name,
      avatar_url: row.avatar_url,
    };
  }
  return authors;
}

/**
 * Рейтинги пачки товарів — заміна функції БД `get_product_ratings`, якої в
 * схемі v2 немає (baseline B13 не везе жодної plpgsql-функції, крім читача
 * актора).
 *
 * 🔴 `status = 'approved'` тут ОБОВʼЯЗКОВИЙ, хоч RLS і звужує таблицю:
 * власний `pending` відгук політика актору віддає, і без предиката покупець
 * бачив би в сітці каталогу рейтинг, накручений його ж нерозглянутою
 * пʼятіркою.
 */
export async function loadProductRatings(
  db: ActorDb,
  productIds: string[],
): Promise<Record<string, ProductRating>> {
  const ratings: Record<string, ProductRating> = {};
  if (productIds.length === 0) return ratings;

  const rows = await db
    .select({
      product_id: productReviews.productId,
      avg_rating: sql<string>`avg(${productReviews.rating})`,
      review_count: count(),
    })
    .from(productReviews)
    .where(
      and(
        inArray(productReviews.productId, productIds),
        eq(productReviews.status, 'approved'),
      ),
    )
    .groupBy(productReviews.productId);

  for (const row of rows) {
    ratings[row.product_id] = {
      avgRating: Math.round(Number(row.avg_rating) * 10) / 10,
      reviewCount: Number(row.review_count),
    };
  }
  return ratings;
}
