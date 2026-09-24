import { propertyOptions, sectionProperties } from 'simplycms/schema';
import type {
  JsonValue,
  PropertyOption,
  SectionProperty,
} from 'simplycms/schema/types';
import { resolveMediaUrl } from 'simplycms/domain/media';

// m4 (рев'ю хвилі B): ОДНЕ визначення `JsonValue` — `simplycms/schema/json`
// (джерело для `sectionProperties.options.$type<JsonValue>()` у самій схемі,
// `schema.ts:57,121`). Локальна копія тут розійшлася б з тим, що бачить
// Drizzle-колонка (той самий клас дефекту, що вже закрито для `images`
// у m3) — реекспорт (не власне визначення), споживачі барелю (`checkout-items`,
// `entities/order.ts`, `entities/new-order.ts`, `shipping.ts`,
// `theme-record.ts`) імпортують звідси, як і раніше.
export type { JsonValue };

/** Мапа select-а характеристики. */
export const propertyColumns = {
  id: sectionProperties.id,
  section_id: sectionProperties.sectionId,
  name: sectionProperties.name,
  slug: sectionProperties.slug,
  property_type: sectionProperties.propertyType,
  is_required: sectionProperties.isRequired,
  is_filterable: sectionProperties.isFilterable,
  has_page: sectionProperties.hasPage,
  sort_order: sectionProperties.sortOrder,
  options: sectionProperties.options,
  created_at: sectionProperties.createdAt,
};

export type PropertyRow = {
  id: SectionProperty['id'];
  section_id: SectionProperty['sectionId'];
  name: SectionProperty['name'];
  slug: SectionProperty['slug'];
  property_type: SectionProperty['propertyType'];
  is_required: SectionProperty['isRequired'];
  is_filterable: SectionProperty['isFilterable'];
  has_page: SectionProperty['hasPage'];
  sort_order: SectionProperty['sortOrder'];
  options: JsonValue | null;
  created_at: SectionProperty['createdAt'];
};

/**
 * Нормалізація рядка властивості. 🔴 m4: каст `unknown → JsonValue` тут
 * більше НЕ потрібен — `options` типізовано в ДЖЕРЕЛІ
 * (`sectionProperties.options.$type<JsonValue>()`, `schema.ts:121`), тож
 * `db.select(propertyColumns)` вже дає `JsonValue | null`. Функція лишається
 * — `??  null` замість недосяжного (за типом) `undefined` із самого select-а.
 */
export function toPropertyRow(row: PropertyRow): PropertyRow {
  return { ...row, options: row.options ?? null };
}

/** Мапа select-а опції характеристики. */
export const optionColumns = {
  id: propertyOptions.id,
  property_id: propertyOptions.propertyId,
  name: propertyOptions.name,
  slug: propertyOptions.slug,
  sort_order: propertyOptions.sortOrder,
  description: propertyOptions.description,
  image_url: propertyOptions.imageUrl,
  meta_title: propertyOptions.metaTitle,
  meta_description: propertyOptions.metaDescription,
  created_at: propertyOptions.createdAt,
};

export type OptionRow = {
  id: PropertyOption['id'];
  property_id: PropertyOption['propertyId'];
  name: PropertyOption['name'];
  slug: PropertyOption['slug'];
  sort_order: PropertyOption['sortOrder'];
  description: PropertyOption['description'];
  image_url: PropertyOption['imageUrl'];
  meta_title: PropertyOption['metaTitle'];
  meta_description: PropertyOption['metaDescription'];
  created_at: PropertyOption['createdAt'];
};

/** Те саме для опції характеристики — єдина медіа-колонка `image_url`. */
export function toOptionRow(row: OptionRow): OptionRow {
  return { ...row, image_url: resolveMediaUrl(row.image_url) };
}
