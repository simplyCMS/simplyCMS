import { and, asc, desc, eq } from 'drizzle-orm';
import { banners, products, sections } from 'simplycms/schema';
import type { Banner } from 'simplycms/contracts';
import type { ActorDb } from './db';
import { bannerColumns, toBanner } from './entities/banner';
import {
  homeProductColumns,
  toHomeProduct,
  type HomeProductRow,
} from './entities/home-product';
import type { SectionRef } from './entities/section';
import { loadSectionProducts } from './home-sections';
import { loadRootSections } from './sections';

/** Скільки товарів у добірках «популярне» й «новинки». */
const FEATURED_LIMIT = 12;

export interface HomePageData {
  banners: Banner[];
  featuredProducts: HomeProductRow[];
  newProducts: HomeProductRow[];
  sections: SectionRef[];
  /** Товари кожного кореневого розділу: `sectionId → товари`. */
  sectionProducts: Record<string, HomeProductRow[]>;
}

/**
 * Дані головної сторінки — усе однією транзакцією.
 *
 * Фаз усе ще дві, але друга більше не N+1: товари всіх розділів приходять
 * одним віконним запитом (`./home-sections`).
 *
 * 🔴 Запити йдуть послідовно, і `Promise.all` тут нічого б не прискорив:
 * транзакція живе на одному зʼєднанні, тож паралелізм уявний (див. `./products`).
 */
export async function loadHomePageData(db: ActorDb): Promise<HomePageData> {
  // Предикат видимості — див. коментар у `./sections`.
  const bannerRows = await db
    .select(bannerColumns)
    .from(banners)
    .where(eq(banners.isActive, true))
    .orderBy(asc(banners.sortOrder));
  const featured = await loadHomeProducts(db, true);
  const newProducts = await loadHomeProducts(db, false);
  const rootSections = await loadRootSections(db);

  return {
    banners: bannerRows.map(toBanner),
    featuredProducts: featured,
    newProducts,
    sections: rootSections,
    sectionProducts: await loadSectionProducts(db, rootSections),
  };
}

/**
 * Добірка головної: `featuredOnly` розрізняє «популярне» й «новинки» —
 * решта запиту в них однакова, тож дублювати його немає сенсу.
 *
 * 🔴 Експортується, бо ті самі дві добірки перезапитує клієнт після
 * інвалідації кешу — і мусить робити це ТИМ САМИМ запитом, що й SSR,
 * інакше сторінка після рефетчу показує інший набір товарів.
 */
export async function loadHomeProducts(
  db: ActorDb,
  featuredOnly: boolean,
): Promise<HomeProductRow[]> {
  const visible = featuredOnly
    ? and(eq(products.isActive, true), eq(products.isFeatured, true))
    : eq(products.isActive, true);

  const rows = await db
    .select({ ...homeProductColumns, section_slug: sections.slug })
    .from(products)
    .leftJoin(sections, eq(products.sectionId, sections.id))
    .where(visible)
    .orderBy(desc(products.createdAt))
    .limit(FEATURED_LIMIT);

  return rows.map((row) => toHomeProduct(row, row.section_slug));
}
