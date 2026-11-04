import type { CatalogValue } from '../../packages/simplycms/src/i18n/types';

/** Усі тексти значення каталогу: рядок — один, множина — по тексту на форму. */
export function textsOf(value: CatalogValue): string[] {
  return typeof value === 'string' ? [value] : Object.values(value);
}

/**
 * Плейсхолдери `{name}` значення, відсортовані для порівняння без урахування порядку.
 * Для множини — об'єднання по всіх формах (форми різних мов мають різну кількість).
 */
export function placeholdersOf(value: CatalogValue): string {
  const found = textsOf(value).flatMap((s) => s.match(/\{(\w+)\}/g) ?? []);
  return [...new Set(found)].sort().join(',');
}

/**
 * Помилки множини каталогу ОДНІЄЇ мови: ключ-множина має рівно категорії
 * `Intl.PluralRules(code)` (не жорстко записаний список — мову додає власник магазину).
 */
export function pluralCategoryProblems(
  code: string,
  catalog: Readonly<Record<string, CatalogValue>>,
): string[] {
  const expected = new Intl.PluralRules(code)
    .resolvedOptions()
    .pluralCategories.slice()
    .sort()
    .join(',');
  return Object.entries(catalog).flatMap(([key, value]) => {
    if (typeof value === 'string') return [];
    const actual = Object.keys(value).sort().join(',');
    return actual === expected
      ? []
      : [`${code}: «${key}» має форми [${actual}], мова вимагає [${expected}]`];
  });
}

/** Ключі, де uk — рядок, а en — множина (чи навпаки): вид значення не збігається. */
export function kindMismatches(
  uk: Readonly<Record<string, CatalogValue>>,
  en: Readonly<Record<string, CatalogValue>>,
): string[] {
  return Object.keys(uk).filter(
    (k) => k in en && typeof uk[k] !== typeof en[k],
  );
}

type ByLocale = Readonly<
  Partial<Record<string, Readonly<Record<string, CatalogValue>>>>
>;

/** Помилки множини ВСІХ мов каталогу теми чи плагіна: мови беруться з ключів, не зі списку. */
export function pluralProblemsByLocale(byLocale: ByLocale): string[] {
  return Object.entries(byLocale).flatMap(([code, catalog]) =>
    pluralCategoryProblems(code, catalog ?? {}),
  );
}

/** Розбіжність виду значення кожної мови з референсною (`uk`): `код: ключ`. */
export function kindMismatchesByLocale(
  reference: Readonly<Record<string, CatalogValue>>,
  byLocale: ByLocale,
): string[] {
  return Object.entries(byLocale).flatMap(([code, catalog]) =>
    kindMismatches(reference, catalog ?? {}).map((k) => `${code}: «${k}»`),
  );
}
