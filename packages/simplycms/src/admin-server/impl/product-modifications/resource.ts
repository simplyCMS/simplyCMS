import { z } from 'zod';
import { productModifications } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * 🔴 isDefault — readonly (контракт хвиль Е1б для таблиць із single-default
 * індексом `idx_product_modifications_single_default`): прапорець ставить
 * лише setDefaultModification (Task 4). sortOrder — writable: клієнт рахує
 * max+1 з уже завантаженого зрізу товару; переставляння — reorder (Task 4).
 */
export const productModificationsOps = defineAdminResource({
  entity: ENTITY.productModifications,
  table: productModifications,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['id', 'productId'],
  sortable: ['sortOrder', 'name'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  touch: 'updatedAt',
  // m3 (рев'ю хвилі B): `images` — jsonb без власної форми в drizzle-zod
  // (`.$type<string[]>()` бачить лише Drizzle, не генератор Zod-схем) —
  // без рефайнменту insert `{}`/update `'str'` проходили б як валідний
  // `any`. Функція, не голий ZodType — `resource-schemas.ts` пояснює чому.
  refine: { images: () => z.array(z.string()) },
  writable: [
    'productId',
    'slug',
    'name',
    'sku',
    'images',
    'sortOrder',
    'stockStatus',
  ],
  readonly: ['id', 'isDefault', 'createdAt', 'updatedAt'],
});
