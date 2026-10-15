// Модифікація товару в графі (М1, Task 10): база, переклади назви, токен, зображення,
// значення. Пише ті самі таблиці, що й `product-graph.ts`, лише для існуючого товару.
import {
  idSql,
  lit,
  type Id,
  type ModificationSpec,
} from './product-graph-types';
import {
  PRIMARY,
  imageSql,
  insertInto,
  jsonList,
  optional,
  slugTokenRowSql,
} from './product-graph-rows';
import { valueSql } from './product-graph-values';

/** Модифікація існуючого товару: база, переклади, токен, зображення, значення. */
export function modificationSql(productId: Id, m: ModificationSpec): string[] {
  const out = [
    insertInto('product_modifications', {
      id: lit(m.id),
      product_id: idSql(productId),
      // М1-TEMP: зноситься в Task 17 — slug/name/images ще читають старі читачі.
      slug: lit(m.slug),
      name: lit(m.name),
      sku: optional(m.sku, lit),
      is_default: optional(m.isDefault, lit),
      sort_order: optional(m.sortOrder, lit),
      stock_status: optional(m.stockStatus, lit),
      images: m.images ? jsonList(m.images) : undefined,
    }),
  ];
  const names = { ...m.translations };
  const translate = (locale: string, name: string) =>
    insertInto('product_modification_translations', {
      product_id: idSql(productId),
      modification_id: lit(m.id),
      locale,
      name: lit(name),
    });
  out.push(translate(PRIMARY, m.name));
  for (const [locale, t] of Object.entries(names))
    out.push(translate(lit(locale), t.name));
  if (m.addresses !== false)
    out.push(
      slugTokenRowSql({
        locale: PRIMARY,
        scopeId: productId,
        slug: m.slug,
        modificationId: m.id,
        isCurrent: true,
      }),
    );
  out.push(...imageSql(productId, m.id, m.images ?? []));
  for (const v of m.values ?? [])
    out.push(...valueSql({ kind: 'modification', id: m.id }, v));
  return out;
}
