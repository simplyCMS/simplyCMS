import { stockByPickupPoint } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/** Залишки — читання фабрикою, запис — saveStock (Е3-3). */
export const stockOps = defineAdminResource({
  entity: ENTITY.stockByPickupPoint,
  table: stockByPickupPoint,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['productId', 'modificationId'],
  sortable: ['createdAt'],
  writable: [],
  readonly: [
    'id',
    'pickupPointId',
    'productId',
    'modificationId',
    'quantity',
    'createdAt',
    'updatedAt',
  ],
});
