import { propertyOptions, sectionProperties } from 'simplycms/schema';
import type { PropertyOption, SectionProperty } from 'simplycms/schema/types';

/**
 * Значення довільного jsonb.
 *
 * 🔴 Оголошено локально, а не взято з генерату PostgREST: нового серверного
 * коду той генерат більше не стосується, а форма JSON від джерела типів не
 * залежить. Тип структурний, тож рядок лишається сумісним зі сторінками,
 * які ще типізовані старим `Tables<…>`.
 */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

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
 * Єдиний каст `unknown → JsonValue` у шарі.
 *
 * Колонка `options` — вільний jsonb адмінки; вітрина її не читає, але тип
 * сторінки вимагає поля, тож рядок проходить через одну явну точку, а не
 * через каст на кожному місці використання.
 */
export function toPropertyRow(
  row: Omit<PropertyRow, 'options'> & { options: unknown },
): PropertyRow {
  return { ...row, options: (row.options ?? null) as JsonValue | null };
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
