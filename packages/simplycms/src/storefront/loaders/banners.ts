import { and, asc, eq } from 'drizzle-orm';
import { banners } from 'simplycms/schema';
import type { Banner } from 'simplycms/contracts';
import type { ActorDb } from './db';
import { bannerColumns, isBannerVisible, toBanner } from './entities/banner';

/** Де саме показується добірка: каркас вітрини має кілька місць під банери. */
export interface BannerQuery {
  placement: string;
  sectionId?: string | null;
}

/**
 * Банери одного місця розміщення.
 *
 * 🔴 `is_active` — предикат КОДУ: RLS на `banners` немає, `app_user` має
 * SELECT на всю таблицю, тож забутий фільтр не впаде, а тихо виведе на
 * головну чернетку акції, яку адмінка вимкнула.
 *
 * Розклад (дати, дні тижня, години) відсіюється після вибірки: він залежить
 * від «зараз», і тримати його в SQL означало б робити запит некешованим за
 * побудовою заради трьох порівнянь у пам'яті.
 */
export async function loadBanners(
  db: ActorDb,
  query: BannerQuery,
): Promise<Banner[]> {
  const scoped = query.sectionId
    ? and(
        eq(banners.isActive, true),
        eq(banners.placement, query.placement),
        eq(banners.sectionId, query.sectionId),
      )
    : and(eq(banners.isActive, true), eq(banners.placement, query.placement));

  const rows = await db
    .select(bannerColumns)
    .from(banners)
    .where(scoped)
    .orderBy(asc(banners.sortOrder));

  const now = new Date();
  return rows.map(toBanner).filter((banner) => isBannerVisible(banner, now));
}
