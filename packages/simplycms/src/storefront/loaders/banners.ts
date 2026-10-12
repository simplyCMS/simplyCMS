import { and, asc, eq, isNotNull } from 'drizzle-orm';
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
  now: Date = new Date(),
): Promise<Banner[]> {
  // Банер `placement='section'` без розділу (розділ видалено, FK SET NULL) не
  // належить жодному місцю. Без `sectionId` у запиті фільтр за розділом зник би
  // й віддав таких «осиротілих» — тому для 'section' розділ завжди обов'язковий.
  const bySection = query.sectionId
    ? eq(banners.sectionId, query.sectionId)
    : query.placement === 'section'
      ? isNotNull(banners.sectionId)
      : undefined;
  const scoped = and(
    eq(banners.isActive, true),
    eq(banners.placement, query.placement),
    bySection,
  );

  const rows = await db
    .select(bannerColumns)
    .from(banners)
    .where(scoped)
    .orderBy(asc(banners.sortOrder));

  return rows.map(toBanner).filter((banner) => isBannerVisible(banner, now));
}
