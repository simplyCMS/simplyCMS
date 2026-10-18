// Модифікація товару в графі (М1, Task 10): база, переклади назви, токени мов, зображення,
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
  optional,
  slugTokenRowSql,
} from './product-graph-rows';
import { missingTokensSql } from './product-graph-projection';
import { valueSql } from './product-graph-values';

/** Модифікація існуючого товару: база, переклади, токен, зображення, значення. */
export function modificationSql(productId: Id, m: ModificationSpec): string[] {
  const out = [
    insertInto('product_modifications', {
      id: lit(m.id),
      product_id: idSql(productId),
      sku: optional(m.sku, lit),
      is_default: optional(m.isDefault, lit),
      sort_order: optional(m.sortOrder, lit),
      stock_status: optional(m.stockStatus, lit),
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
  if (m.addresses !== false) {
    for (const [locale, slug] of Object.entries(m.tokens ?? {}))
      out.push(
        slugTokenRowSql({
          locale,
          scopeId: productId,
          slug,
          modificationId: m.id,
          isCurrent: true,
        }),
      );
    out.push(missingTokensSql(productId, m.id, m.slug));
  }
  out.push(...imageSql(productId, m.id, m.images ?? []));
  for (const v of m.values ?? [])
    out.push(...valueSql({ kind: 'modification', id: m.id }, v));
  return out;
}
