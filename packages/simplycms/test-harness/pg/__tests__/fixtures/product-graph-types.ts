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

/**
 * Власники значень властивостей — ЄДИНЕ джерело для билдера (`valueSql`) і гарда
 * «єдиного записувача» (`product-graph-fixture.test.ts`): таблиця значень власника —
 * `<власник>_property_values`, перекладів — `<власник>_property_value_translations`.
 */
export const VALUE_OWNERS = ['product', 'modification'] as const;
export type ValueOwnerKind = (typeof VALUE_OWNERS)[number];
export interface ValueOwner {
  kind: ValueOwnerKind;
  id: Id;
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
  /**
   * `false` — без токенів у `slug_tokens`: викликач пише їх сам У ТІЙ САМІЙ транзакції
   * (тригер наявності токена на COMMIT, І16), інакше коміт відхиляється.
   */
  addresses?: boolean;
  /** Явні поточні токени за мовами; решта мов `draft`/`published` отримує `slug`. */
  tokens?: Record<string, string>;
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
  /**
   * `false` — без адрес і проєкції: викликач пише адреси сам У ТІЙ САМІЙ транзакції
   * (тригер наявності адреси на COMMIT, І16), інакше коміт відхиляється.
   */
  addresses?: boolean;
  /** Явні поточні адреси за мовами; решта мов `draft`/`published` отримує `slug`. */
  paths?: Record<string, string>;
  modifications?: ModificationSpec[];
  values?: ValueSpec[];
}

/** Мінімум від зʼєднання: `pg.Client`, пул чи обгортка над `queryRows`. */
export interface PgClientLike {
  query(sql: string): Promise<unknown>;
}
