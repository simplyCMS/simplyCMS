import { discounts } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Знижки — колекція адмінки для СПИСКУ й видалення.
 * 🔴 `writable: []`: рядок знижки окремо від цілей і умов не пишеться —
 * лише `saveDiscountOp` (одна транзакція під `discount-config`).
 * Фабричні insert/update serverFn-ами не виставляються. Видалення — НЕ
 * фабричний remove (він іде без локу), а `removeDiscountsOp` під
 * `discount-config`.
 */
export const discountsOps = defineAdminResource({
  entity: ENTITY.discounts,
  table: discounts,
  operation: 'discount.manage',
  mode: 'eager',
  filterable: ['id', 'groupId', 'priceTypeId'],
  sortable: ['priority'],
  defaultOrder: { column: 'priority', direction: 'asc' },
  writable: [],
  readonly: [
    'id',
    'name',
    'description',
    'groupId',
    'discountType',
    'discountValue',
    'priority',
    'isActive',
    'startsAt',
    'endsAt',
    'createdAt',
    'updatedAt',
    'priceTypeId',
  ],
});
