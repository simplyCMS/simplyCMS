import type { z } from 'zod';
import { sectionProperties } from 'simplycms/schema';
import { SLUG_RE } from 'simplycms/domain';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Властивості товарів (Е4, Task 3). Режим on-demand — як у картці товару
 * Е3 (Е4-9: режими колекцій не змінюються).
 *
 * 🔴 Е4-5: `propertyType` — insertOnly. Зміна `multiselect → text` лишала б
 * осиротілі рядки `option_id` у значеннях товарів.
 * 🔴 `sectionId` — readonly: нові властивості глобальні (`NULL`), до
 * розділу їх привʼязує призначення. `options` — легасі-jsonb, адмінка його
 * не пише (опції — окрема таблиця `property_options`).
 * 🔴 Е4-6/Е4-7: slug унікальний глобально (DDL) і в форматі `SLUG_RE`.
 */
export const sectionPropertiesOps = defineAdminResource({
  entity: ENTITY.sectionProperties,
  table: sectionProperties,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['id'],
  sortable: ['sortOrder', 'name'],
  refine: { slug: (s: z.ZodString) => s.regex(SLUG_RE) },
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
});
