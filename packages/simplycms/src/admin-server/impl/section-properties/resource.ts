import type { z } from 'zod';
import { propertyOptions, sectionProperties } from 'simplycms/schema';
import { SLUG_FORMAT } from 'simplycms/domain/slugs';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Властивості товарів. Режим on-demand — як у картці товару
 * (режими колекцій не змінюються).
 *
 * 🔴 `propertyType` — insertOnly. Зміна `multiselect → text` лишала б
 * осиротілі рядки `option_id` у значеннях товарів.
 * 🔴 `sectionId` — readonly: нові властивості глобальні (`NULL`), до
 * розділу їх привʼязує призначення. `options` — легасі-jsonb, адмінка його
 * не пише (опції — окрема таблиця `property_options`).
 * 🔴 Slug унікальний глобально (DDL) і в форматі `SLUG_FORMAT`.
 */
export const sectionPropertiesOps = defineAdminResource({
  entity: ENTITY.sectionProperties,
  table: sectionProperties,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['id'],
  sortable: ['sortOrder', 'name'],
  refine: { slug: (s: z.ZodString) => s.regex(SLUG_FORMAT) },
  writable: [
    'name',
    'slug',
    'isRequired',
    'isFilterable',
    'hasPage',
    'sortOrder',
  ],
  insertOnly: ['propertyType'],
  readonly: ['id', 'sectionId', 'options', 'createdAt'],
  // FK `property_options.property_id` — CASCADE; без опції фото
  // опцій пережили б властивість.
  cascadeMedia: [
    {
      fk: propertyOptions.propertyId,
      column: propertyOptions.imageUrl,
      entityType: 'property_option',
    },
  ],
});
