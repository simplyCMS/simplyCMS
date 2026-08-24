import { asc, desc, eq } from 'drizzle-orm';
import { products, sections } from 'simplycms/schema';
import type { ActorDb } from './db';

/**
 * Дані для `/sitemap.xml` — рівно те, з чого будуються URL-и (В2-К1а).
 *
 * 🔴 Вибірка навмисно вузька: sitemap не рендерить ні цін, ні картинок, тож
 * тягнути повний рядок товару означало б платити трафіком БД за поля, які
 * ніхто не прочитає. Пошуковий робот приходить регулярно — це не разовий
 * запит.
 */

/** Розділ каталогу в sitemap. */
export interface SitemapSection {
  readonly slug: string;
  readonly updated_at: string;
}

/** Товар у sitemap разом зі slug-ом розділу, з якого будується URL. */
export interface SitemapProduct {
  readonly slug: string;
  readonly updated_at: string;
  /** `null` — товар без розділу; URL тоді йде під технічним `products`. */
  readonly section_slug: string | null;
}

export interface SitemapData {
  readonly sections: SitemapSection[];
  readonly products: SitemapProduct[];
}

/**
 * Активні розділи й товари для sitemap.
 *
 * 🔴 `is_active` — обовʼязковий предикат в ОБОХ запитах (пояснення про модель
 * видимості — у `./sections`). Тут ціна помилки навіть вища, ніж на сторінці:
 * неактивний товар у sitemap — це запрошення робота на 404, і виправити
 * наслідок після індексації складніше, ніж не пустити його туди.
 *
 * 🔴 Помилка запиту НЕ ковтається — жодного `try/catch` тут немає навмисно.
 * Sitemap із самих лише статичних URL виглядає як успіх, а SEO-інтерсептор
 * зафіксував би цю неправду в CDN на годину (див. `storefront-routes/seo`).
 */
export async function loadSitemapData(db: ActorDb): Promise<SitemapData> {
  const sectionRows = await db
    .select({ slug: sections.slug, updated_at: sections.updatedAt })
    .from(sections)
    .where(eq(sections.isActive, true))
    .orderBy(asc(sections.sortOrder));

  // Розділ підтягується `leftJoin`-ом БЕЗ фільтра активності: URL товару має
  // ту саму форму, що й на сторінці каталогу, а «активність розділу» — окреме
  // правило показу, яке тут звузило б вибірку до `products` мовчки.
  const productRows = await db
    .select({
      slug: products.slug,
      updated_at: products.updatedAt,
      section_slug: sections.slug,
    })
    .from(products)
    .leftJoin(sections, eq(products.sectionId, sections.id))
    .where(eq(products.isActive, true))
    .orderBy(desc(products.updatedAt));

  return { sections: sectionRows, products: productRows };
}
