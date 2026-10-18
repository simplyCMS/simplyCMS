import { localePrefixSegment } from 'simplycms/domain';
import type { Locale, LocaleSet } from 'simplycms/i18n';

export type { LocaleSet };

/**
 * Порожній набір мов для запитів, які Start не віддає на рендер сторінки
 * (server functions, API, медіа): `getRouter()` викликається і для них, але
 * мови їм не потрібні, а читати кеш мов на кожне зображення було б зайвим
 * запитом до БД. Лоадер кореня відмовляє на такому наборі (див. `root-data`),
 * тож документ без мовного контексту не вдає, що мова є.
 */
export const NO_LOCALES: LocaleSet = {
  primary: '',
  published: [],
  known: [],
};

/** Результат розбору шляху запиту. */
export type ResolvedLocale = {
  /** Мова сторінки: код із набору (регістр як у БД), для чужого сегмента — основна. */
  locale: Locale;
  /** Шлях мав префікс мови (зокрема основної — це привід для 301 на нормалізації). */
  prefixed: boolean;
  /** Шлях без префікса мови: те, що бачить роутер. */
  rest: string;
};

/**
 * Верхньорівневі сегменти, що ніколи не бувають мовою вітрини: адмінка, API,
 * server functions, статика й медіа. Одна константа для rewrite, нормалізації
 * і розбору — інакше «що є вітриною» довелось би казати двічі.
 */
export const NON_STOREFRONT_SEGMENTS: readonly string[] = [
  'admin',
  'api',
  '_serverFn',
  'assets',
  'media',
];

function firstSegment(pathname: string): string {
  const end = pathname.indexOf('/', 1);
  return pathname.slice(1, end === -1 ? undefined : end);
}

/** Вітринний шлях — усе, що не адмінка, API, server functions, статика й медіа. */
export function isStorefrontPath(pathname: string): boolean {
  return !NON_STOREFRONT_SEGMENTS.includes(firstSegment(pathname));
}

/**
 * Префікс URL мови: `lower(code)` (майстер §3.2). Регістр коду в БД не впливає
 * на адресу, а `/EN/x` мовою не є — порівняння йде з уже нижнім регістром.
 */
export function localePrefix(code: Locale): string {
  return localePrefixSegment(code);
}

/**
 * Мова запиту ЛИШЕ з першого сегмента шляху (І30): без cookie, сесії,
 * `Accept-Language` і `Vary`. Параметра заголовка немає за типом — це і є
 * доказ, а лінт забороняє читати заголовок у зоні вітрини.
 *
 * ЄДИНЕ джерело для SSR, клієнта (через `window.__SCMS_LOCALES__`),
 * інтерсептора нормалізації та екранів `NotFound`/помилки: другого парсера
 * першого сегмента в коді бути не повинно (умова архітектора 2).
 *
 * Сегмент мови лишається префіксом навіть для відомої, але неопублікованої
 * мови: 404 вирішує нормалізація, а тут це лише факт «префікс є».
 */
export function resolveRequestLocale(
  originalPathname: string,
  set: LocaleSet,
): ResolvedLocale {
  const plain: ResolvedLocale = {
    locale: set.primary,
    prefixed: false,
    rest: originalPathname,
  };
  if (!isStorefrontPath(originalPathname)) return plain;

  const segment = firstSegment(originalPathname);
  // Основну перевіряємо першою: вона є і в `published`, і в `known`.
  const code =
    [set.primary, ...set.known, ...set.published].find(
      (c) => localePrefix(c) === segment,
    ) ?? null;
  if (code === null) return plain;

  const rest = originalPathname.slice(segment.length + 1) || '/';
  return { locale: code, prefixed: true, rest };
}
