import { asc, desc, eq } from 'drizzle-orm';
import {
  catalogProductTexts as texts,
  languages,
  products,
  sections,
} from 'simplycms/schema';
import type { LanguageVersion } from '../seo/hreflang';
import type { ActorDb } from './db';
import { pageVisible } from './product-visibility';

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
  readonly updated_at: Date;
}

/**
 * Товар у sitemap: опубліковані мовні версії з адресами з реєстру. Скільки
 * `<url>` він дасть і з якими альтернативами, вирішує `indexPolicy`, а не цей
 * лоадер: sitemap не має власної думки, що «перекладено».
 */
export interface SitemapProduct {
  readonly updated_at: Date;
  /** Основна мова магазину. */
  readonly primary: string;
  readonly languages: readonly LanguageVersion[];
}

export interface SitemapData {
  readonly sections: SitemapSection[];
  readonly products: SitemapProduct[];
}

/**
 * Активні розділи й товари (з мовними версіями) для sitemap.
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

  // Товари — з проєкції тексту (адреса й `is_translated` для кожної ОПУБЛІКОВАНОЇ
  // мови); `is_active` — як і всюди на вітрині. Рядок на (товар × мову), які
  // нижче групуються в товар.
  const rows = await db
    .select({
      id: products.id,
      updated_at: products.updatedAt,
      code: texts.locale,
      path: texts.path,
      isTranslated: texts.isTranslated,
      isDefault: languages.isDefault,
    })
    .from(texts)
    .innerJoin(languages, eq(languages.code, texts.locale))
    .innerJoin(products, eq(products.id, texts.productId))
    .where(pageVisible())
    .orderBy(
      desc(products.updatedAt),
      asc(products.id),
      asc(languages.sortOrder),
      asc(languages.code),
    );

  const byProduct = new Map<
    string,
    { updated_at: Date; primary: string | null; languages: LanguageVersion[] }
  >();
  for (const row of rows) {
    const entry = byProduct.get(row.id) ?? {
      updated_at: row.updated_at,
      primary: null,
      languages: [],
    };
    entry.languages.push({
      code: row.code,
      isTranslated: row.isTranslated,
      path: row.path,
    });
    if (row.isDefault) entry.primary = row.code;
    byProduct.set(row.id, entry);
  }

  const productList: SitemapProduct[] = [];
  for (const entry of byProduct.values()) {
    // Товар без рядка основної мови не має «основної версії» для canonical.
    if (entry.primary !== null) {
      productList.push({
        updated_at: entry.updated_at,
        primary: entry.primary,
        languages: entry.languages,
      });
    }
  }

  return { sections: sectionRows, products: productList };
}
