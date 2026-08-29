// Стабільний namespace ключів кешу React Query (без React/supabase).
//
// 🔴 V2: фабрики query-опцій поверх портів (`catalogQueries`/`orderQueries`)
// і ключі замовлень знесені разом із шаром репозиторіїв — браузер у БД не
// ходить, дані приходять серверними лоадерами `simplycms/storefront`.
// Ключі лишились: ними лоадер і клієнт домовляються про одну комірку кешу.

import type { ProductQuery } from 'simplycms/contracts';

/** Стабільний namespace ключів для кешу React Query. */
export const catalogKeys = {
  all: ['catalog'] as const,
  product: (idOrSlug: string) => ['catalog', 'product', idOrSlug] as const,
  products: (q: ProductQuery) => ['catalog', 'products', q] as const,
  sectionProducts: (sectionId: string, q?: ProductQuery) =>
    ['catalog', 'section-products', sectionId, q ?? null] as const,
  sections: ['catalog', 'sections'] as const,
  properties: ['catalog', 'properties'] as const,
  stock: (ids: string[]) => ['catalog', 'stock', ...ids] as const,
};
