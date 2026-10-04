import { z } from 'zod';
import { SLUG_RE } from 'simplycms/domain';
import type { MessageKey } from 'simplycms/i18n';
import type { SectionProperty } from 'simplycms/schema/types';

/** Сім значень enum-у БД `property_type` — у тому ж порядку. */
export const PROPERTY_TYPES = [
  'text',
  'number',
  'select',
  'multiselect',
  'range',
  'color',
  'boolean',
] as const satisfies readonly SectionProperty['propertyType'][];

export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** Підпис типу — КЛЮЧ, резолвиться в рендері. */
export const PROPERTY_TYPE_LABEL: Record<PropertyType, MessageKey> = {
  text: 'admin.properties.type.text',
  number: 'admin.properties.type.number',
  select: 'admin.properties.type.select',
  multiselect: 'admin.properties.type.multiselect',
  range: 'admin.properties.type.range',
  color: 'admin.properties.type.color',
  boolean: 'admin.properties.type.boolean',
};

/** Тип із власними опціями (таблиця `property_options`). */
export const hasOptions = (type: PropertyType) =>
  type === 'select' || type === 'multiselect';

/**
 * Форма властивості (Е4, Task 8). slug — `SLUG_RE` (T1), його ж перевіряє
 * сервер (Е4-7). `propertyType` є у формі, але в patch не йде (Е4-5:
 * insertOnly) — редагування показує його текстом.
 */
export const propertyFormSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().regex(SLUG_RE),
  propertyType: z.enum(PROPERTY_TYPES),
  isRequired: z.boolean(),
  isFilterable: z.boolean(),
  hasPage: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
});

export type PropertyFormInput = z.input<typeof propertyFormSchema>;
export type PropertyFormValues = z.output<typeof propertyFormSchema>;

export const EMPTY_PROPERTY: PropertyFormInput = {
  name: '',
  slug: '',
  propertyType: 'text',
  isRequired: false,
  isFilterable: false,
  hasPage: false,
  sortOrder: 0,
};

/** Поля update. 🔴 Без `propertyType` — його немає в update-схемі (Е4-5). */
export function toPropertyPatch(v: PropertyFormValues) {
  return {
    name: v.name,
    slug: v.slug,
    isRequired: v.isRequired,
    isFilterable: v.isFilterable,
    hasPage: v.hasPage,
    sortOrder: v.sortOrder,
  } satisfies Partial<SectionProperty>;
}

/**
 * Повний оптимістичний рядок для insert. Нова властивість глобальна
 * (`sectionId: null`) — до розділу її привʼязує призначення; легасі-jsonb
 * `options` адмінка не пише.
 */
export function toPropertyDraft(
  v: PropertyFormValues,
  id: string,
  now: Date,
): SectionProperty {
  return {
    ...toPropertyPatch(v),
    id,
    propertyType: v.propertyType,
    sectionId: null,
    options: null,
    createdAt: now,
  };
}
