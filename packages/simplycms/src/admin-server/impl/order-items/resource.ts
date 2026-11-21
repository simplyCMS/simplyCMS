import { orderItems } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Позиції замовлення — лише читання (редагування позицій — окремі операції).
 * `stockPointId`/`stockReserved` — облік фактично списаного: картка
 * показує їх як є, пише їх лише `simplycms/inventory`.
 */
export const orderItemsOps = defineAdminResource({
  entity: ENTITY.orderItems,
  table: orderItems,
  operation: 'order.read',
  mode: 'on-demand',
  filterable: ['orderId'],
  sortable: ['createdAt'],
  defaultOrder: { column: 'createdAt', direction: 'asc' },
  writable: [],
  maxLimit: 500,
  readonly: [
    'id',
    'orderId',
    'productId',
    'modificationId',
    'name',
    'price',
    'quantity',
    'total',
    'createdAt',
    'basePrice',
    'discountData',
    'stockPointId',
    'stockReserved',
  ],
});
