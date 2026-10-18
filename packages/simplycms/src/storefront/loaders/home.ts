import { and, asc, desc, eq } from 'drizzle-orm';
import {
  catalogProductTexts as texts,
  languages,
  products,
  sections,
} from 'simplycms/schema';
import type { TextLocale } from 'simplycms/domain/translations';
import type { Banner } from 'simplycms/contracts';
import type { ActorDb } from './db';
import { loadBanners } from './banners';
import {
  homeProductColumns,
  toHomeProduct,
  type HomeProductRow,
} from './entities/home-product';
import type { SectionRef } from './entities/section';
import { loadSectionProducts } from './home-sections';
import { languageOf, textJoinOn } from './product-list-text';
import { pageVisible } from './product-visibility';
import {
  loadGuestPriceTypes,
  loadViewerPricesByProduct,
  type ViewerPriceTypes,
} from 'simplycms/commerce';
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
export async function loadHomePageData(
  db: ActorDb,
  viewer: ViewerPriceTypes,
  text: TextLocale,
): Promise<HomePageData> {
  // Р24: лише розміщення `home` і лише в межах розкладу — тема бере ПЕРШИЙ
  // банер як hero, тож банер іншого місця чи з майбутнім розкладом не годиться.
  const homeBanners = await loadBanners(db, { placement: 'home' });
  const featured = await loadHomeProducts(db, true, viewer, text);
  const newProducts = await loadHomeProducts(db, false, viewer, text);
  const rootSections = await loadRootSections(db);

  return {
    banners: homeBanners,
    featuredProducts: featured,
    newProducts,
    sections: rootSections,
    sectionProducts: await loadSectionProducts(db, rootSections, viewer, text),
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
  viewer: ViewerPriceTypes,
  text: TextLocale,
): Promise<HomeProductRow[]> {
  const visible = featuredOnly
    ? and(pageVisible(), eq(products.isFeatured, true))
    : pageVisible();

  const rows = await db
    .select({ ...homeProductColumns, section_slug: sections.slug })
    .from(products)
    .innerJoin(texts, textJoinOn(text))
    .innerJoin(languages, languageOf())
    .leftJoin(sections, eq(products.sectionId, sections.id))
    .where(visible)
    // Другий ключ — щоб LIMIT не відсікав «які трапляться» серед рядків з
    // однаковим `created_at` (усі рядки одного `insert … select` дістають
    // один `now()`, тож без `id` порядок нижче ліміту недетермінований).
    .orderBy(desc(products.createdAt), asc(products.id))
    .limit(FEATURED_LIMIT);

  // Прайс — лише види глядача (Р29); SSR-ціна нижче — за гостьовими.
  const prices = await loadViewerPricesByProduct(
    db,
    rows.map((row) => row.id),
    viewer,
  );
  const guestPriceTypes = await loadGuestPriceTypes(db);
  return rows.map((row) =>
    toHomeProduct(
      row,
      row.section_slug,
      prices[row.id] ?? [],
      guestPriceTypes,
      text.primary,
    ),
  );
}
