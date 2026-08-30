// Стабільний namespace ключів кешу React Query (без React/supabase).
//
// 🔴 V2: фабрики query-опцій поверх портів (`catalogQueries`/`orderQueries`)
// і ключі замовлень знесені разом із шаром репозиторіїв — браузер у БД не
// ходить, дані приходять серверними лоадерами `simplycms/storefront`.
// Ключі лишились: ними лоадер і клієнт домовляються про одну комірку кешу.

import type { ProductQuery } from 'simplycms/contracts';
import { AGGREGATE, ENTITY, entityKey } from 'simplycms/contracts/entities';

const products = entityKey(ENTITY.products);
const sections = entityKey(ENTITY.sections);
const sectionProperties = entityKey(ENTITY.sectionProperties);

/**
 * Ключі каталогу. 🔴 Сегмент 0 — імʼя таблиці з ENTITY, не рядок
 * `'catalog'`: інакше вітрина й адмінка адресують ту саму сутність
 * різними ключами, і мутація в одній не інвалідовує другу.
 */
export const catalogKeys = {
  all: products.all(),
  product: (idOrSlug: string) => products.detail(idOrSlug),
  products: (q: ProductQuery) => [...products.list(), q] as const,
  sectionProducts: (sectionId: string, q?: ProductQuery) =>
    [...products.scoped('section', sectionId), q ?? null] as const,
  sections: sections.list(),
  properties: sectionProperties.list(),
  stock: (ids: string[]) => [...AGGREGATE.stockInfo.key, ...ids] as const,
};
