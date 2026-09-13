/**
 * Очікуваний бейдж і JSON-LD `availability` ЗІ СТАТУСУ БД — рев'ю M-7.
 *
 * Окремим модулем (канон 150 рядків, той самий прийом, що й `register.mjs`):
 * без нього ці дві таблиці штовхнули б `funnel.mjs` за межу.
 *
 * 🔴 Та сама відповідність, яку рахують `ProductStockBadge`/`StockDisplay`
 * (i18n `product.*`) і `schemaOrgAvailability` (`simplycms/domain/inventory`).
 * Плаский `.mjs`-скрипт не тягне TS-пакет напряму (без ts-loader тут немає
 * рантайму для `.ts`), тож таблиця продубльована — але керована реальним
 * `stock_status` з БД, а НЕ хардкодом «завжди in_stock», яким перевірки були
 * до фіксу: до нього обидві зеленіли БЕЗ огляду на статус товару в сіді.
 */
const EXPECTED_BADGE_TEXT = {
  in_stock: 'В наявності',
  out_of_stock: 'Немає в наявності',
  on_order: 'Під замовлення',
};

const EXPECTED_JSONLD_AVAILABILITY = {
  in_stock: 'https://schema.org/InStock',
  out_of_stock: 'https://schema.org/OutOfStock',
  on_order: 'https://schema.org/BackOrder',
};

/** `null`/незаданий статус — DEFAULT колонки БД, семантика «в наявності». */
export const badgeTextFor = (status) =>
  EXPECTED_BADGE_TEXT[status ?? 'in_stock'];

export const jsonLdAvailabilityFor = (status) =>
  EXPECTED_JSONLD_AVAILABILITY[status ?? 'in_stock'];
