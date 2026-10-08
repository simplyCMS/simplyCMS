import { orders } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Е5-7: `access_token` — секрет гостьового доступу до замовлення
 * (`orders_select_own_or_token`); адміну він не потрібен, а в браузері й
 * кеші — зайвий носій секрету. Один перелік для ресурсу і для проєкції
 * іменованої операції `changeOrderStatusOp` (`./change-status`): прибрати
 * колонку з omit тут — означає відкрити її в ОБОХ шляхах.
 */
export const ORDERS_OMIT = ['accessToken'] as const;

/** Рядок замовлення, який бачить адмінка: без прихованих колонок. */
export type OrderRow = Omit<
  typeof orders.$inferSelect,
  (typeof ORDERS_OMIT)[number]
>;

/**
 * Замовлення в адмінці — лише читання (Е5-10): generic-write порожній,
 * зміна статусу — іменована операція з доменним інваріантом
 * («скасоване — кінцеве», повернення залишку). `maxLimit` — серверна межа
 * сторінки К3-5 (Е5-12).
 */
export const ordersOps = defineAdminResource({
  entity: ENTITY.orders,
  table: orders,
  operation: 'order.read',
  mode: 'on-demand',
  filterable: ['id', 'statusId', 'userId'],
  sortable: ['createdAt', 'orderNumber', 'total'],
  defaultOrder: { column: 'createdAt', direction: 'desc' },
  writable: [],
  omit: ORDERS_OMIT,
  maxLimit: 100,
  readonly: [
    'id',
    'userId',
    'orderNumber',
    'statusId',
    'firstName',
    'lastName',
    'email',
    'phone',
    'deliveryAddress',
    'deliveryCity',
    'paymentMethod',
    'subtotal',
    'total',
    'notes',
    'createdAt',
    'updatedAt',
    'shippingMethodId',
    'shippingZoneId',
    'shippingRateId',
    'shippingCost',
    'pickupPointId',
    'shippingData',
    'hasDifferentRecipient',
    'recipientFirstName',
    'recipientLastName',
    'recipientPhone',
    'recipientEmail',
    'savedRecipientId',
    'savedAddressId',
    'personalDataErasedAt',
  ],
});
