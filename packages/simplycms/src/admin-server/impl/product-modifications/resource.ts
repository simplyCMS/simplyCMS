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
