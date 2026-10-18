import { and, eq } from 'drizzle-orm';
import {
  catalogProductTexts as texts,
  languages,
  products,
} from 'simplycms/schema';
import type { TextLocale } from 'simplycms/domain/translations';

/**
 * Текст товару для списків (лістинг, головна, розділ, сторінка значення): назва,
 * адреса й короткий опис мови запиту з проєкції `catalog_product_texts` (П7) — не з
 * колонок `products`, які ще дзеркалять лише основну мову (знесе Task 17).
 * `slug` рядка — ПОТОЧНА АДРЕСА цієї мови (`texts.path`): картка веде на `/en/<path en>`,
 * а не на адресу основної мови.
 *
 * `fallback` — імена полів, узятих з основної мови (ознака з даних проєкції, не
 * порівняння текстів); з неї `listLangs` дає `lang` для `FallbackText` (І37).
 */
export const listTextColumns = {
  name: texts.name,
  slug: texts.path,
  short_description: texts.shortDescription,
  meta_title: texts.metaTitle,
  meta_description: texts.metaDescription,
  fallback: texts.fallbackFields,
};

/** Умова приєднання рядка проєкції товару в мові запиту. */
export const textJoinOn = (text: TextLocale) =>
  and(eq(texts.productId, products.id), eq(texts.locale, text.locale));

/**
 * Умова приєднання мови рядка проєкції. Видимість (мова `published`, товар `is_active`) —
 * ЄДИНИЙ предикат `pageVisible()` у `where` лістингу: ту саму умову читають сторінка товару,
 * sitemap, історія адрес і всі списки, тож правило змінюється в одному місці.
 */
export const languageOf = () => eq(languages.code, texts.locale);

/** `lang` основної мови для полів назви й короткого опису, узятих з fallback. */
export function listLangs(
  fallback: readonly string[],
  primary: string,
): { name_lang: string | null; short_description_lang: string | null } {
  return {
    name_lang: fallback.includes('name') ? primary : null,
    short_description_lang: fallback.includes('short_description')
      ? primary
      : null,
  };
}
