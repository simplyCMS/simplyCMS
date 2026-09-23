import { productPrices } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Ціни — ЛИШЕ читання фабрикою; запис — атомарним набором
 * saveProductPrices (Е3-10). writable порожній: insert/update/remove цього
 * ресурсу serverFn-ами НЕ виставляються (index.ts).
 */
export const productPricesOps = defineAdminResource({
  entity: ENTITY.productPrices,
  table: productPrices,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['productId', 'modificationId', 'priceTypeId'],
  sortable: ['createdAt'],
  writable: [],
  readonly: [
    'id',
    'priceTypeId',
    'productId',
    'modificationId',
    'price',
    'oldPrice',
    'createdAt',
    'updatedAt',
  ],
});
