// Значення властивостей у графі товару (М1, Task 10, Р18): рядок значення з `value_kind`,
// переклади тексту, дзеркало в старі колонки.
import { idSql, lit, type Id, type ValueSpec } from './product-graph-types';
import { PRIMARY, insertInto, optional } from './product-graph-rows';

/** Значення властивості товару чи модифікації; текст — у перекладах. */
export function valueSql(
  owner: { kind: 'product' | 'modification'; id: Id },
  v: ValueSpec,
): string[] {
  const product = owner.kind === 'product';
  const table = product
    ? 'product_property_values'
    : 'modification_property_values';
  const translations = product
    ? 'product_property_value_translations'
    : 'modification_property_value_translations';
  const mirror =
    v.kind === 'boolean'
      ? lit(String(v.bool ?? false))
      : v.kind === 'color'
        ? lit(v.color)
        : undefined;
  const out = [
    insertInto(table, {
      id: lit(v.id),
      [product ? 'product_id' : 'modification_id']: idSql(owner.id),
      property_id: idSql(v.propertyId),
      value_kind: `${lit(v.kind)}::property_type`,
      option_id: optional(v.optionId, idSql),
      numeric_value: optional(v.number, (n) => lit(n)),
      bool_value: optional(v.bool, (b) => lit(b)),
      color_value: optional(v.color, lit),
      // М1-TEMP: зноситься в Task 17 — старі читачі беруть текст із `value`.
      value: mirror,
    }),
  ];
  for (const [locale, text] of Object.entries(v.text ?? {})) {
    out.push(
      insertInto(translations, {
        value_id: lit(v.id),
        locale: lit(locale),
        value: lit(text),
      }),
    );
  }
  if (v.text) {
    // М1-TEMP: зноситься в Task 17 — дзеркало тексту основної мови в `value`.
    out.push(
      `update public.${table} set value = (select value from public.${translations}
         where value_id = ${lit(v.id)} and locale = ${PRIMARY}) where id = ${lit(v.id)}`,
    );
  }
  return out;
}
