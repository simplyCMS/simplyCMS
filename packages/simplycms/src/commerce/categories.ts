import { eq } from 'drizzle-orm';
import { profiles, userCategories } from 'simplycms/schema';
import type { ActorDb } from 'simplycms/db';

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

/**
 * Тип ціни категорії або `null`, якщо категорії немає чи тип у ній не задано.
 *
 * 🔴 Приймає ЕФЕКТИВНУ категорію (`loadPricingContext`: персональна, для
 * гостя й профілю з `category_id NULL` — дефолтна, Е6в-19), а не `userId`:
 * колишній `loadUserPriceTypeId` джойнив `profiles`, тож гість і NULL-профіль
 * діставали глобальний дефолтний тип, хоча належать дефолтній категорії з
 * ВЛАСНИМ типом (F5 фінального рев'ю). Персональна категорія, як і раніше,
 * читається лише під актором власника (`loadUserCategoryId`).
 */
export async function loadCategoryPriceTypeId(
  db: ActorDb,
  categoryId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ price_type_id: userCategories.priceTypeId })
    .from(userCategories)
    .where(eq(userCategories.id, categoryId))
    .limit(1);

  return row?.price_type_id ?? null;
}
