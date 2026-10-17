import { and, asc, eq } from 'drizzle-orm';
import {
  catalogProductTexts as texts,
  languages,
  products,
  sections,
} from 'simplycms/schema';
import { sanitizeNullableRichHtml } from 'simplycms/sanitize';
import type { ActorDb } from './db';
import { productBaseColumns } from './entities/product';
import { sectionRefColumns } from './entities/section';
import { pageVisible } from './product-visibility';
import { indexPolicy } from '../seo/index-policy';
import type { LanguageVersion } from '../seo/hreflang';
import {
  FALLBACK_FIELDS,
  type ProductAddress,
  type ProductPageBase,
} from './product-page-types';

export * from './product-page-types';

const projectionText = {
  name: texts.name,
  short_description: texts.shortDescription,
  description: texts.description,
  meta_title: texts.metaTitle,
  meta_description: texts.metaDescription,
};

/**
 * Товар за адресою `(мова, шлях)` з проєкції тексту (П7/П8): мова мусить бути
 * `published` (чернетку відкривати прямим посиланням не можна — перевірка тут,
 * а не лише в нормалізації, бо `getProduct` викликається й напряму з клієнта),
 * товар — `is_active`. Історичної адреси тут немає: її віддає ОДИН 301
 * нормалізації до роутера, а видалена сутність не лишає рядків — це 404.
 */
export async function loadProductPageBase(
  db: ActorDb,
  address: ProductAddress,
): Promise<ProductPageBase | null> {
  const [row] = await db
    .select({
      product: productBaseColumns,
      section: sectionRefColumns,
      text: projectionText,
      isTranslated: texts.isTranslated,
      fallback: texts.fallbackFields,
    })
    .from(texts)
    .innerJoin(languages, eq(languages.code, texts.locale))
    .innerJoin(products, eq(products.id, texts.productId))
    .leftJoin(sections, eq(products.sectionId, sections.id))
    .where(
      and(
        eq(texts.locale, address.locale),
        eq(texts.path, address.path),
        pageVisible(),
      ),
    )
    .limit(1);
  if (!row) return null;

  // Усі опубліковані версії товару: з них hreflang і x-default.
  const versions = await db
    .select({
      code: texts.locale,
      path: texts.path,
      isTranslated: texts.isTranslated,
      isDefault: languages.isDefault,
    })
    .from(texts)
    .innerJoin(
      languages,
      and(eq(languages.code, texts.locale), eq(languages.status, 'published')),
    )
    .where(eq(texts.productId, row.product.id))
    .orderBy(asc(languages.sortOrder), asc(languages.code));

  const primaryRow = versions.find((v) => v.isDefault);
  const primary = primaryRow?.code ?? address.locale;
  const languageVersions: LanguageVersion[] = versions.map((v) => ({
    code: v.code,
    isTranslated: v.isTranslated,
    path: v.path,
  }));

  return {
    product: row.product,
    section: row.section?.id ? row.section : null,
    text: {
      ...row.text,
      description: sanitizeNullableRichHtml(row.text.description, 'content'),
    },
    page: {
      locale: address.locale,
      primary,
      path: address.path,
      isTranslated: row.isTranslated,
      // Ознака з даних проєкції, а не порівняння текстів: переклад, буквально
      // рівний основній мові, не fallback.
      fallbackFields: FALLBACK_FIELDS.filter((f) => row.fallback.includes(f)),
      seo: indexPolicy({
        locale: address.locale,
        primary,
        isTranslated: row.isTranslated,
        languages: languageVersions,
      }),
    },
  };
}
