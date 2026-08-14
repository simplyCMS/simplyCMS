/**
 * Фікстури детерміністичного сіду пілота — ЄДИНЕ джерело правди.
 *
 * Звідси беруть дані обидві сторони e2e-контуру:
 *  - `scripts/pilot-pack/seed-sql.mjs` рендерить із них `supabase/seed.sql`
 *    (перегенерація — `node scripts/pilot-seed.mjs`, парність стереже
 *    `tests/pilot-seed.test.ts`);
 *  - `scripts/pilot-pack/gate-b.mjs` у режимі `--e2e` асертить рівно ці назви
 *    в SSR-HTML.
 *
 * 🔴 Тому назви НЕ дублюються в SQL руками: розсинхрон «сід каже одне, гейт
 * чекає інше» неможливий за побудовою.
 */

/** Префікс усіх сідових сутностей — щоб їх було видно в БД неозброєним оком. */
export const SEED_PREFIX = 'Pilot Seed ';

/** Тема, яку сід робить активною (без неї `getActiveTheme` не резолвиться). */
export const SEED_THEME = 'default';

/** Плагін, рядок якого сід кладе в `plugins` (модуль є в конфізі магазину). */
export const SEED_PLUGIN = {
  name: 'hello-world',
  displayName: 'Hello World',
  version: '0.1.0',
  description:
    'Demo plugin: a dashboard widget proving the plugin contour works.',
  author: 'SimplyCMS',
  hooks: [{ name: 'admin.dashboard.widgets' }],
};

/**
 * Код типу ціни, за яким SSR рахує ціни анонімного відвідувача.
 * Рядок створює міграція `20260210135107_*` (`is_default = true`).
 */
export const SEED_PRICE_TYPE_CODE = 'retail';

/** Кореневі секції (`parent_id IS NULL`) — джерело каруселей головної. */
export const SEED_SECTIONS = [
  {
    slug: 'pilot-seed-panels',
    name: `${SEED_PREFIX}Panels`,
    description: 'Секція сіду пілота: панелі.',
    sortOrder: 10,
  },
  {
    slug: 'pilot-seed-inverters',
    name: `${SEED_PREFIX}Inverters`,
    description: 'Секція сіду пілота: інвертори.',
    sortOrder: 20,
  },
  {
    slug: 'pilot-seed-batteries',
    name: `${SEED_PREFIX}Batteries`,
    description: 'Секція сіду пілота: акумулятори.',
    sortOrder: 30,
  },
];

/**
 * Товари сіду.
 *
 * 🔴 `name` — тільки латиниця, цифри й пробіли: Gate B звіряє назви з сирим
 * SSR-HTML, а React екранує `& < > " '` (гард — `tests/pilot-seed.test.ts`).
 * `hasModifications: false` у всіх — тоді ціна резолвиться простим шляхом
 * (`modification_id IS NULL`), без окремих рядків модифікацій.
 */
export const SEED_PRODUCTS = [
  {
    slug: 'pilot-seed-panel-alpha',
    name: `${SEED_PREFIX}Panel Alpha`,
    sectionSlug: 'pilot-seed-panels',
    price: 4200,
    oldPrice: 4800,
    isFeatured: true,
  },
  {
    slug: 'pilot-seed-panel-beta',
    name: `${SEED_PREFIX}Panel Beta`,
    sectionSlug: 'pilot-seed-panels',
    price: 5100,
    oldPrice: null,
    isFeatured: false,
  },
  {
    slug: 'pilot-seed-inverter-gamma',
    name: `${SEED_PREFIX}Inverter Gamma`,
    sectionSlug: 'pilot-seed-inverters',
    price: 18300,
    oldPrice: null,
    isFeatured: true,
  },
  {
    slug: 'pilot-seed-battery-delta',
    name: `${SEED_PREFIX}Battery Delta`,
    sectionSlug: 'pilot-seed-batteries',
    price: 26500,
    oldPrice: 29900,
    isFeatured: false,
  },
];

/** Символи, які React екранує в HTML — у назвах сіду їх бути не може. */
export const HTML_UNSAFE_CHARS = /[&<>"']/;

/** Назви товарів сіду — очікування Gate B у режимі `--e2e`. */
export function seedProductNames() {
  return SEED_PRODUCTS.map((product) => product.name);
}
