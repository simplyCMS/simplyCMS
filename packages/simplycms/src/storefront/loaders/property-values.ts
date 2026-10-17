import type { ProductPropertyValueViewModel } from 'simplycms/contracts/views';
import {
  productPropertyValues,
  propertyOptions,
  sectionProperties,
  type propertyType,
} from 'simplycms/schema';

export type PropertyType = (typeof propertyType.enumValues)[number];

/**
 * Характеристика товару у формі, яку читає картка.
 *
 * 🔴 Ключі `property_options` / `section_properties` — це імена ТАБЛИЦЬ, а не
 * зв'язків: так їх називав вбудований ресурс PostgREST, і саме на ці імена
 * дивиться `useProductContent`. Перейменування було б окремою правкою UI.
 */
export interface ProductPropertyValueRow {
  property_id: string;
  value: string | null;
  numeric_value: number | null;
  option_id: string | null;
  /** Мова тексту, коли він з основної мови (fallback): огортається `lang` (І37). */
  value_lang: string | null;
  property_options: { id: string; slug: string; name: string } | null;
  section_properties: {
    id: string;
    name: string;
    slug: string;
    property_type: string;
    has_page: boolean;
  } | null;
}

/** Мапа select-а значення характеристики разом з опцією й самою характеристикою. */
export const propertyValueColumns = {
  value_id: productPropertyValues.id,
  property_id: productPropertyValues.propertyId,
  value: productPropertyValues.value,
  value_kind: productPropertyValues.valueKind,
  bool_value: productPropertyValues.boolValue,
  color_value: productPropertyValues.colorValue,
  numeric_value: productPropertyValues.numericValue,
  option_id: productPropertyValues.optionId,
  option: {
    id: propertyOptions.id,
    slug: propertyOptions.slug,
    name: propertyOptions.name,
  },
  property: {
    id: sectionProperties.id,
    name: sectionProperties.name,
    slug: sectionProperties.slug,
    property_type: sectionProperties.propertyType,
    has_page: sectionProperties.hasPage,
  },
};

/** Сирий рядок до нормалізації: `numeric` — рядок, приєднані гілки — nullable. */
export interface RawPropertyValueRow {
  value_id: string;
  property_id: string;
  /** М1-TEMP: зноситься в Task 17 — старе дзеркало; значення читається за `value_kind`. */
  value: string | null;
  value_kind: PropertyType | null;
  bool_value: boolean | null;
  color_value: string | null;
  numeric_value: string | null;
  option_id: string | null;
  option: { id: string; slug: string; name: string } | null;
  property: {
    id: string;
    name: string;
    slug: string;
    property_type: string;
    has_page: boolean;
  } | null;
}

/**
 * Відображуване значення за ТИПОМ значення (Р18), а не за колонкою `value`, що
 * тепер лише дзеркало: текст — з перекладів (мова, інакше основна), булеве — з
 * `bool_value` (`'true'`/`'false'`), колір — з `color_value`. Число й опція
 * читаються з `numeric_value`/`option`, тож `value` у них `null`.
 * Тип береться з `value_kind`, а для рядків без нього (до Task 17) — з типу властивості.
 */
export function displayValue(
  row: Pick<
    RawPropertyValueRow,
    'value' | 'value_kind' | 'bool_value' | 'color_value' | 'property'
  >,
  text: string | null | undefined,
): string | null {
  const kind = row.value_kind ?? row.property?.property_type ?? null;
  switch (kind) {
    case 'boolean':
      return row.bool_value === null ? row.value : String(row.bool_value);
    case 'color':
      return row.color_value ?? row.value;
    case 'text':
      // М1-TEMP: зноситься в Task 17 — без рядка перекладу лишається старе дзеркало.
      return text ?? row.value;
    case null:
      return row.value;
    default:
      return null;
  }
}

/**
 * Доводить рядок до форми картки: `numeric` у число, приєднані гілки — під
 * іменами таблиць, `value` — за типом значення. Перевірка `?.id` страхує від
 * рядка з порожнього `leftJoin`, а не лише від `null` цілим обʼєктом.
 */
export function toPropertyValueRow(
  row: RawPropertyValueRow,
  text?: { text: string | null; lang: string | null },
): ProductPropertyValueRow {
  return {
    property_id: row.property_id,
    value: displayValue(row, text?.text),
    value_lang: text?.text ? text.lang : null,
    numeric_value:
      row.numeric_value === null ? null : Number(row.numeric_value),
    option_id: row.option_id,
    property_options: row.option?.id ? row.option : null,
    section_properties: row.property?.id ? row.property : null,
  };
}

/**
 * Той самий рядок, але під іменами КОНТРАКТУ вітрини (`option`/`property`).
 *
 * 🔴 Дві форми співіснують не з недогляду: `product_property_values` картки
 * читаються під іменами таблиць PostgREST (див. докблок вище), а
 * характеристики модифікацій одразу їдуть у view-model теми. Перейменувати
 * першу — окрема правка UI, а не побічний ефект цього переходу.
 */
export function toPropertyValueViewModel(
  row: RawPropertyValueRow,
  text?: { text: string | null; lang: string | null },
): ProductPropertyValueViewModel {
  const normalized = toPropertyValueRow(row, text);
  return {
    property_id: normalized.property_id,
    value: normalized.value,
    numeric_value: normalized.numeric_value,
    option_id: normalized.option_id,
    value_lang: normalized.value_lang,
    option: normalized.property_options,
    property: normalized.section_properties,
  };
}
