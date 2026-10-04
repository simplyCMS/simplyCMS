import type { z } from 'zod';
import { propertyOptions } from 'simplycms/schema';
import { SLUG_RE } from 'simplycms/domain';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Опції властивостей (Е4, Task 3), on-demand (Е4-9).
 *
 * 🔴 Е4-5: `propertyId` — insertOnly. Перенесення опції між властивостями —
 * це видалення плюс створення, не patch (значення товарів посилаються на
 * опцію, і тип нової властивості може її не підтримувати).
 * `filterable` несе `id` — для картки опції (findOne).
 */
export const propertyOptionsOps = defineAdminResource({
  entity: ENTITY.propertyOptions,
  table: propertyOptions,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['propertyId', 'id'],
  sortable: ['sortOrder'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  refine: { slug: (s: z.ZodString) => s.regex(SLUG_RE) },
  writable: [
    'name',
    'slug',
    'sortOrder',
    'description',
    'imageUrl',
    'metaTitle',
    'metaDescription',
  ],
  insertOnly: ['propertyId'],
  readonly: ['id', 'createdAt'],
});
