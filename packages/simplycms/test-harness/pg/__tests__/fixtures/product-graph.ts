// Єдиний запис графа товару для харнесу (М1, Task 10): база, переклади, адреси,
// модифікації з токенами, значення властивостей, зображення. Пряма вставка в ці
// таблиці з тестів заборонена (`product-graph-fixture.test.ts` це доводить grep-ом).
// Граф — стан, який лишають команди: переклад основної мови (І4) і поточна адреса й
// токен у кожній мові `draft`/`published` (І16) — тригери перевіряють їх на COMMIT.
//
// 🔴 Усе йде ОДНИМ оператором `do`-блока: так спільний замок `languages-set`
// (тригер SC004 на `url_paths`/`slug_tokens`) живе рівно стільки, скільки запис,
// і в автокоміті, і всередині чужої транзакції; зайвих `begin/commit` у викликача немає.
// Мова "основна" — підзапит до `languages.is_default`, не літерал.
import { queryRows } from '../../apply.mjs';
import {
  idSql,
  lit,
  type Id,
  type ModificationSpec,
  type PgClientLike,
  type ProductGraphSpec,
  type ValueOwner,
  type ValueSpec,
} from './product-graph-types';
import {
  PRIMARY,
  imageSql,
  insertInto,
  optional,
  textRow,
  urlPathRowSql,
} from './product-graph-rows';
import { modificationSql } from './product-graph-modification';
import { valueSql } from './product-graph-values';
import { missingPathsSql, projectionSql } from './product-graph-projection';

export * from './product-graph-types';
export { PRIMARY, slugTokenRowSql, urlPathRowSql } from './product-graph-rows';
export { valueSql } from './product-graph-values';
export { modificationSql } from './product-graph-modification';

const LOCK =
  "perform pg_advisory_xact_lock_shared(hashtextextended('languages-set', 0))";

/** Оператори графа товару у порядку залежностей (без замка). */
export function productGraphStatements(spec: ProductGraphSpec): string[] {
  const texts = { ...spec.texts, name: spec.name };
  const out = [
    insertInto('products', {
      id: lit(spec.id),
      section_id: optional(spec.sectionId, idSql),
      is_active: optional(spec.isActive, lit),
      is_featured: optional(spec.isFeatured, lit),
      has_modifications: optional(spec.hasModifications, lit),
      sku: optional(spec.sku, lit),
      stock_status: optional(spec.stockStatus, lit),
    }),
    insertInto('product_translations', {
      product_id: lit(spec.id),
      locale: PRIMARY,
      ...textRow(texts),
    }),
  ];
  if (spec.addresses !== false)
    for (const [locale, path] of Object.entries(spec.paths ?? {}))
      out.push(
        urlPathRowSql({ locale, path, productId: spec.id, isCurrent: true }),
      );
  for (const [locale, t] of Object.entries(spec.translations ?? {}))
    out.push(
      insertInto('product_translations', {
        product_id: lit(spec.id),
        locale: lit(locale),
        ...textRow(t),
      }),
    );
  out.push(...imageSql(spec.id, null, spec.images ?? []));
  for (const m of spec.modifications ?? [])
    out.push(...modificationSql(spec.id, m));
  for (const v of spec.values ?? [])
    out.push(...valueSql({ kind: 'product', id: spec.id }, v));
  // Стан, еквівалентний командам (І16, І23): адреса в кожній активній мові й рядки проєкції.
  if (spec.addresses !== false)
    out.push(missingPathsSql(spec.id, spec.slug), projectionSql(spec.id));
  return out;
}

/**
 * ЛИШЕ рядок бази товару чи модифікації — для негативних контролів тригерів джерела (І4)
 * і наявності (І16): без перекладу, адрес і токенів коміт такої транзакції відхиляється.
 */
export const bareProductSql = (id: string): string =>
  insertInto('products', { id: lit(id) });
export const bareModificationSql = (productId: Id, id: string): string =>
  insertInto('product_modifications', {
    id: lit(id),
    product_id: idSql(productId),
  });

/** Оператори під спільним замком одним `do`-блоком: готовий SQL для масивів фікстур. */
export function inLockedBlock(statements: string[]): string {
  const body = [LOCK, ...statements].join(';\n');
  if (body.includes('$pg$'))
    throw new Error('product-graph: літерал містить $pg$');
  return `do $pg$ begin\n${body};\nend $pg$`;
}

export const productGraphSql = (spec: ProductGraphSpec): string =>
  inLockedBlock(productGraphStatements(spec));
export const modificationGraphSql = (
  productId: Id,
  m: ModificationSpec,
): string => inLockedBlock(modificationSql(productId, m));
export const valueGraphSql = (owner: ValueOwner, v: ValueSpec): string =>
  inLockedBlock(valueSql(owner, v));

export async function insertProductGraph(
  db: PgClientLike,
  spec: ProductGraphSpec,
): Promise<void> {
  await db.query(productGraphSql(spec));
}

/** Те саме для тестів, що тримають лише `dbUrl` (кожен виклик — окреме зʼєднання). */
export async function insertProductGraphAt(
  dbUrl: string,
  spec: ProductGraphSpec,
): Promise<void> {
  await queryRows(dbUrl, productGraphSql(spec));
}

/** Модифікація (з токеном, перекладами) існуючого товару. */
export async function insertModificationAt(
  dbUrl: string,
  productId: Id,
  m: ModificationSpec,
): Promise<void> {
  await queryRows(dbUrl, modificationGraphSql(productId, m));
}

/** Значення властивості існуючого товару чи модифікації. */
export async function insertValueAt(
  dbUrl: string,
  owner: ValueOwner,
  v: ValueSpec,
): Promise<void> {
  await queryRows(dbUrl, valueGraphSql(owner, v));
}

/** Адаптер для фікстур із `rows(sql)` (`f.rows`, `d.f.rows`). */
export const viaRows = (
  rows: (sql: string) => Promise<unknown>,
): PgClientLike => ({
  query: rows,
});
