// Рядкові будівники SQL графа товару (М1, Task 10): `insert` одного рядка за
// мапою колонок, перекладні поля, зображення, рядки реєстрів адрес і токенів.
// Замок `languages-set` бере НЕ тут, а `inLockedBlock` у `product-graph.ts`.
import { randomUUID } from 'node:crypto';
import { idSql, lit, type Id, type ProductTexts } from './product-graph-types';

export const PRIMARY = '(select code from public.languages where is_default)';
export type Row = Record<string, string | undefined>;

export const insertInto = (table: string, row: Row): string => {
  const entries = Object.entries(row).filter(([, v]) => v !== undefined);
  return `insert into public.${table} (${entries.map(([k]) => k).join(', ')}) values (${entries.map(([, v]) => v).join(', ')})`;
};

export const optional = <T>(
  v: T | undefined,
  f: (x: T) => string,
): string | undefined => (v === undefined ? undefined : f(v));

const TEXT_COLUMNS: Record<keyof ProductTexts, string> = {
  name: 'name',
  shortDescription: 'short_description',
  description: 'description',
  metaTitle: 'meta_title',
  metaDescription: 'meta_description',
};

export const textRow = (texts: Partial<ProductTexts>): Row =>
  Object.fromEntries(
    (Object.keys(TEXT_COLUMNS) as (keyof ProductTexts)[])
      .filter((k) => texts[k] !== undefined)
      .map((k) => [TEXT_COLUMNS[k], lit(texts[k])]),
  );

export const jsonList = (keys: string[]): string =>
  `${lit(JSON.stringify(keys))}::jsonb`;

export const imageSql = (
  productId: Id,
  modificationId: Id | null,
  keys: string[],
): string[] =>
  keys.map((key, i) =>
    insertInto('product_images', {
      id: lit(randomUUID()),
      product_id: idSql(productId),
      modification_id:
        modificationId === null ? undefined : idSql(modificationId),
      storage_key: lit(key),
      sort_order: String(i),
    }),
  );

/**
 * Один рядок реєстру адрес. Окремий від графа, бо тести самих реєстрів пишуть
 * рядки довільної форми (в т.ч. хибної, для негативних контролів); `locale` —
 * літерал мови або SQL-вираз (`PRIMARY`). Замок мов бере викликач.
 */
export const urlPathRowSql = (r: {
  id?: string;
  locale: string;
  path: string;
  productId: Id | null;
  isCurrent: boolean;
}): string =>
  insertInto('url_paths', {
    id: lit(r.id ?? randomUUID()),
    locale: r.locale === PRIMARY ? PRIMARY : lit(r.locale),
    path: lit(r.path),
    product_id: r.productId === null ? undefined : idSql(r.productId),
    is_current: lit(r.isCurrent),
  });

/** Один рядок реєстру токенів; `modificationId: null` — рядок без цілі (для негативних контролів). */
export const slugTokenRowSql = (r: {
  id?: string;
  locale: string;
  scopeId: Id | null;
  slug: string;
  modificationId: Id | null;
  isCurrent: boolean;
}): string =>
  insertInto('slug_tokens', {
    id: lit(r.id ?? randomUUID()),
    locale: r.locale === PRIMARY ? PRIMARY : lit(r.locale),
    scope_id: r.scopeId === null ? undefined : idSql(r.scopeId),
    slug: lit(r.slug),
    modification_id:
      r.modificationId === null ? undefined : idSql(r.modificationId),
    is_current: lit(r.isCurrent),
  });
