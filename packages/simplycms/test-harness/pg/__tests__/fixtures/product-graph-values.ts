// Значення властивостей у графі товару (М1, Task 10, Р18): рядок значення з `value_kind`,
// переклади тексту (для `text` основна мова обов'язкова — тригер І5).
import {
  idSql,
  lit,
  type ValueOwner,
  type ValueSpec,
} from './product-graph-types';
import { insertInto, optional } from './product-graph-rows';

/** Значення властивості товару чи модифікації; текст — у перекладах. */
export function valueSql(owner: ValueOwner, v: ValueSpec): string[] {
  const table = `${owner.kind}_property_values`;
  const translations = `${owner.kind}_property_value_translations`;
  const out = [
    insertInto(table, {
      id: lit(v.id),
      [`${owner.kind}_id`]: idSql(owner.id),
      property_id: idSql(v.propertyId),
      value_kind: `${lit(v.kind)}::property_type`,
      option_id: optional(v.optionId, idSql),
      numeric_value: optional(v.number, (n) => lit(n)),
      bool_value: optional(v.bool, (b) => lit(b)),
      color_value: optional(v.color, lit),
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
  return out;
}
