// Типи й SQL-літерали фікстурного хелпера графа товару (М1, Task 10). Сам SQL
// збирає `product-graph.ts` — це єдиний файл харнесу, що вставляє в таблиці товару.
import type { propertyType } from 'simplycms/schema';

export type PropertyType = (typeof propertyType.enumValues)[number];

/** Скалярний підзапит замість UUID: `{ sql: "(select id from public.sections where slug = 'x')" }`. */
export interface Sql {
  readonly sql: string;
}
export type Id = string | Sql;

export const sqlRef = (sql: string): Sql => ({ sql });

/** SQL-літерал тексту (одинарні лапки подвоюються); `null`/`undefined` → `null`. */
export const lit = (v: string | number | boolean | null | undefined): string =>
  v === null || v === undefined
    ? 'null'
    : typeof v === 'string'
      ? `'${v.replaceAll("'", "''")}'`
      : String(v);

export const idSql = (id: Id): string =>
  typeof id === 'string' ? lit(id) : id.sql;

/** Перекладні поля товару (майстер §3.1); `name` обов'язкове лише в основній мові. */
export interface ProductTexts {
  name: string;
  shortDescription: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
}

export interface ValueSpec {
  id: string;
  propertyId: Id;
  kind: PropertyType;
  optionId?: Id;
  number?: number | string;
  bool?: boolean;
  color?: string;
  /** Текст за мовами; лише для `kind = 'text'` (пишеться в таблицю перекладів). */
  text?: Record<string, string>;
}

export interface ModificationSpec {
  id: string;
  slug: string;
  name: string;
  sku?: string | null;
  isDefault?: boolean;
  sortOrder?: number;
  stockStatus?: 'in_stock' | 'out_of_stock' | 'on_order';
  images?: string[];
  /** `false` — без токена в `slug_tokens`: тести самих реєстрів адрес заводять його власноруч. */
  addresses?: boolean;
  /** Назви модифікації іншими мовами (основна мова = `name`). */
  translations?: Record<string, { name: string }>;
  values?: ValueSpec[];
}

export interface ProductGraphSpec {
  id: string;
  sectionId?: Id;
  slug: string;
  name: string;
  texts?: Partial<ProductTexts>;
  translations?: Record<string, Partial<ProductTexts>>;
  isActive?: boolean;
  isFeatured?: boolean;
  hasModifications?: boolean;
  sku?: string | null;
  stockStatus?: 'in_stock' | 'out_of_stock' | 'on_order';
  images?: string[];
  /** `false` — без поточної адреси в `url_paths`: тести самих реєстрів адрес заводять її власноруч. */
  addresses?: boolean;
  modifications?: ModificationSpec[];
  values?: ValueSpec[];
}

/** Мінімум від зʼєднання: `pg.Client`, пул чи обгортка над `queryRows`. */
export interface PgClientLike {
  query(sql: string): Promise<unknown>;
}
