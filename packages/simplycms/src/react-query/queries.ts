// Стабільний namespace ключів кешу React Query (без React і клієнта БД).
//
// 🔴 V2: фабрики query-опцій поверх портів (`catalogQueries`/`orderQueries`)
// і ключі замовлень знесені разом із шаром репозиторіїв — браузер у БД не
// ходить, дані приходять серверними лоадерами `simplycms/storefront`.
// Ключі лишились: ними лоадер і клієнт домовляються про одну комірку кешу.

import type { ProductQuery } from 'simplycms/contracts';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';

/**
 * Ключі каталогу. 🔴 Сегмент 0 — імʼя таблиці з ENTITY, не рядок
 * `'catalog'`: інакше вітрина й адмінка адресують ту саму сутність
 * різними ключами, і мутація в одній не інвалідовує другу.
 *
 * 🔴 Живий лише `sectionProducts` (карусель головної,
 * `storefront-routes/pages/home/queries.ts`). Решта колишніх членів
 * (`all`/`product`/`products`/`sections`/`properties`/`stock`) не мали
 * жодного споживача поза власним тестом і прибрані фінальним рев'ю Е1а;
 * `stock` до того ж колізував із `core/hooks/useStock.ts`
 * (`[...AGGREGATE.stockInfo.key, modificationId, productId]`) — той самий
 * ключ під різні типи payload при двох заданих id.
 */
export const catalogKeys = {
  sectionProducts: (sectionId: string, locale: string, q?: ProductQuery) =>
    [
      ...entityKey(ENTITY.products, locale).scoped('section', sectionId),
      q ?? null,
    ] as const,
};

/** Сегмент ключа для ГОСТЯ — гість бачить лише гостьові види цін (Р29). */
export const PRICE_VIEW_GUEST = 'guest';

/**
 * Сегмент для ПОКУПЦЯ, чий вид цін клієнту не відомий (збій середовища цін
 * без жодного успішного читання; покупець без жодного виду). 🔴 Не `'guest'`:
 * serverFn фільтрує за видом із сесії, тож у такій комірці — прайс покупця.
 */
export const PRICE_VIEW_UNRESOLVED = 'unresolved';

/**
 * Ключ публічного запиту з цінами (Р29, рішення архітектора 2026-10-12):
 * сегмент 0 — з реєстру сутностей, як і раніше (префіксна інвалідація не
 * змінюється), сегмент 1 — вид цін глядача: `'guest'` або id виду цін.
 *
 * 🔴 Саме вид цін, а не `userId`: payload сервер фільтрує за видом, тож два
 * покупці одного виду ділять комірку, а вхід, вихід чи зміна категорії
 * дають НОВУ комірку замість чужого прайсу в старій. `null` — вид ще
 * невідомий (сесія чи середовище цін у дорозі); такий запит не ходить.
 */
export function priceViewKey(
  key: readonly unknown[],
  view: string | null,
): readonly unknown[] {
  return [key[0], view, ...key.slice(1)];
}

/**
 * Мітка запитів із прайсом глядача: за нею вхід і вихід скидають їх усі
 * (`useViewerPriceSync`), не чіпаючи колекцій адмінки зі спільним сегментом 0.
 */
export const VIEWER_PRICED_META = { viewerPriced: true } as const;

/** Запит несе прайс глядача — предикат для `removeQueries`/`resetQueries`. */
export function isViewerPricedQuery(query: {
  meta?: Record<string, unknown>;
}): boolean {
  return query.meta?.viewerPriced === true;
}
