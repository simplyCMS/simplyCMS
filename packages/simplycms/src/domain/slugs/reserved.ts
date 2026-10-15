// Службові сегменти URL (майстер §3.2, І19): шлях сутності й токен властивості
// не можуть їм дорівнювати — інакше сторінка товару перекрила б /cart, а
// `?sort=` змішався б із токеном властивості.

/**
 * Службові сегменти: роути ядра, статика й файли для краулерів. `assets`
 * резервується, бо статика з `/assets/` віддається раніше за роутер
 * (`server.mjs`). Коди мов (`lower(code)`) передає викликач — вони динамічні.
 */
export const RESERVED_SEGMENTS: readonly string[] = [
  'admin',
  'api',
  'assets',
  'auth',
  'cart',
  'catalog',
  'checkout',
  'my',
  'media',
  'order-success',
  'profile',
  'properties',
  'search',
  'sitemap.xml',
  'robots.txt',
];

/**
 * Ключі query, які значать щось самі по собі. `q`, `limit`, `view` резервуються
 * під пошук наступної хвилі, щоб токен властивості не зайняв їх раніше.
 */
export const RESERVED_QUERY_KEYS: readonly string[] = [
  'mod',
  'page',
  'sort',
  'price',
  'in_stock',
  'q',
  'limit',
  'view',
];

const lowered = (values: readonly string[]): Set<string> =>
  new Set(values.map((value) => value.toLowerCase()));

/**
 * Чи заборонений сегмент як шлях сутності: службовий, код мови або верхньорівневе
 * ім'я з `public/` збірки (`publicNames`). Порівняння без урахування регістру:
 * сегмент URL мови — `lower(code)`, а `code` канонічно `pt-BR`.
 */
export function isReservedPath(
  segment: string,
  languageSegments: readonly string[],
  publicNames: readonly string[],
): boolean {
  const value = segment.toLowerCase();
  return (
    RESERVED_SEGMENTS.includes(value) ||
    lowered(languageSegments).has(value) ||
    lowered(publicNames).has(value)
  );
}

/** Чи заборонений токен властивості: службові сегменти, коди мов і ключі query. */
export function isReservedPropertyToken(
  token: string,
  languageSegments: readonly string[],
): boolean {
  const value = token.toLowerCase();
  return (
    RESERVED_SEGMENTS.includes(value) ||
    RESERVED_QUERY_KEYS.includes(value) ||
    lowered(languageSegments).has(value)
  );
}
