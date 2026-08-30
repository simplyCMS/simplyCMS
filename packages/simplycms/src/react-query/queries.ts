// Стабільний namespace ключів кешу React Query (без React/supabase).
//
// 🔴 V2: фабрики query-опцій поверх портів (`catalogQueries`/`orderQueries`)
// і ключі замовлень знесені разом із шаром репозиторіїв — браузер у БД не
// ходить, дані приходять серверними лоадерами `simplycms/storefront`.
// Ключі лишились: ними лоадер і клієнт домовляються про одну комірку кешу.

import type { ProductQuery } from 'simplycms/contracts';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';

const products = entityKey(ENTITY.products);

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
  sectionProducts: (sectionId: string, q?: ProductQuery) =>
    [...products.scoped('section', sectionId), q ?? null] as const,
};
