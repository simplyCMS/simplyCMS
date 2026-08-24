import { eq } from 'drizzle-orm';
import { profiles, userCategories } from 'simplycms/schema';
import type { ActorDb } from './db';

/** Профіль покупця у формі, яку читають сторінки кабінету. */
export interface ProfileRow {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  category: { name: string } | null;
}

/** Поля, які покупець сміє змінювати сам. */
export interface ProfileUpdate {
  firstName: string;
  lastName: string;
  phone: string | null;
}

/**
 * Профіль поточного покупця.
 *
 * 🔴 Фільтр `user_id` тут — не заміна RLS, а її дублікат: політика
 * `profiles_select_own` уже звузила таблицю до власника. Явний предикат
 * лишається тому, що він робить намір запиту читабельним, а не тому, що
 * без нього приїхало б чуже.
 */
export async function loadProfile(
  db: ActorDb,
  userId: string,
): Promise<ProfileRow | null> {
  const [row] = await db
    .select({
      first_name: profiles.firstName,
      last_name: profiles.lastName,
      email: profiles.email,
      phone: profiles.phone,
      avatar_url: profiles.avatarUrl,
      category_name: userCategories.name,
    })
    .from(profiles)
    .leftJoin(userCategories, eq(profiles.categoryId, userCategories.id))
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!row) return null;

  return {
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    avatar_url: row.avatar_url,
    category: row.category_name === null ? null : { name: row.category_name },
  };
}

/** Зберігає особисті поля профілю. Рядок звужує політика `profiles_update_own`. */
export async function updateProfile(
  db: ActorDb,
  userId: string,
  update: ProfileUpdate,
): Promise<void> {
  await db
    .update(profiles)
    .set({
      firstName: update.firstName,
      lastName: update.lastName,
      phone: update.phone,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(profiles.userId, userId));
}

/**
 * Тип ціни, призначений категорії покупця, або `null`.
 *
 * 🔴 Раніше це читав браузер запитом `profiles → user_categories`, тобто
 * персональна знижкова категорія була доступна будь-кому, хто підставив
 * чужий `user_id`. Тепер `userId` приходить із серверної сесії.
 */
export async function loadUserPriceTypeId(
  db: ActorDb,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ price_type_id: userCategories.priceTypeId })
    .from(profiles)
    .innerJoin(userCategories, eq(profiles.categoryId, userCategories.id))
    .where(eq(profiles.userId, userId))
    .limit(1);

  return row?.price_type_id ?? null;
}
