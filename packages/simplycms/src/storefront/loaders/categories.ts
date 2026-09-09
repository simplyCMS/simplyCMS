import { eq } from 'drizzle-orm';
import { profiles, userCategories } from 'simplycms/schema';
import type { ActorDb } from './db';

/**
 * Категорія покупця — джерело умови `user_category` рушія знижок.
 *
 * 🔴 Читається ЛИШЕ під `withCustomerDb`, і `userId` сюди приходить із
 * серверної сесії. Раніше браузер брав `profiles.category_id` запитом за
 * `user_id` із клієнта — тобто чужу знижкову категорію міг дізнатися будь-хто,
 * хто підставив чужий id. Політика `profiles_select_own` тепер звужує рядок
 * до власника, але вона довіряє тому id, який їй назвав сервер.
 */
export async function loadUserCategoryId(
  db: ActorDb,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ category_id: profiles.categoryId })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  return row?.category_id ?? null;
}

/**
 * Категорія за замовчуванням — те, що дістає анонім.
 *
 * Без неї гість не потрапляв би в жодну умову `user_category`, і базова
 * роздрібна акція, налаштована на категорію «Роздріб», не показувалась би
 * саме тим, кому призначена.
 */
export async function loadDefaultUserCategoryId(
  db: ActorDb,
): Promise<string | null> {
  const [row] = await db
    .select({ id: userCategories.id })
    .from(userCategories)
    .where(eq(userCategories.isDefault, true))
    .limit(1);

  return row?.id ?? null;
}
