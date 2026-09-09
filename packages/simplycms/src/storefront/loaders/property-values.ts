import type { ProductPropertyValueViewModel } from 'simplycms/contracts/views';
import {
  productPropertyValues,
  propertyOptions,
  sectionProperties,
} from 'simplycms/schema';

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
  property_options: { id: string; slug: string } | null;
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
  property_id: productPropertyValues.propertyId,
  value: productPropertyValues.value,
  numeric_value: productPropertyValues.numericValue,
  option_id: productPropertyValues.optionId,
  option: { id: propertyOptions.id, slug: propertyOptions.slug },
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
  property_id: string;
  value: string | null;
  numeric_value: string | null;
  option_id: string | null;
  option: { id: string; slug: string } | null;
  property: {
    id: string;
    name: string;
    slug: string;
    property_type: string;
    has_page: boolean;
  } | null;
}

/**
 * Доводить рядок до форми картки: `numeric` у число, приєднані гілки — під
 * іменами таблиць. Перевірка `?.id` страхує від рядка з порожнього
 * `leftJoin`, а не лише від `null` цілим обʼєктом.
 */
export function toPropertyValueRow(
  row: RawPropertyValueRow,
): ProductPropertyValueRow {
  return {
    property_id: row.property_id,
    value: row.value,
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
): ProductPropertyValueViewModel {
  const normalized = toPropertyValueRow(row);
  return {
    property_id: normalized.property_id,
    value: normalized.value,
    numeric_value: normalized.numeric_value,
    option_id: normalized.option_id,
    option: normalized.property_options,
    property: normalized.section_properties,
  };
}
