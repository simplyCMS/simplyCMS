import { orders } from 'simplycms/schema';

/**
 * Тестовий конфіг ресурсу на `orders` для юнітів `omit`/`maxLimit` (Е5-7,
 * Е5-12). НЕ справжній ресурс замовлень (його будує Task 4): тут лише
 * покриття колонок, щоб exhaustiveness фабрики сходилась БЕЗ `accessToken` —
 * його кожен тест кладе або в `omit`, або (негативний контроль) нікуди.
 */
export const ORDERS_WRITABLE = ['statusId'] as const;

export const ORDERS_READONLY = [
  'id',
  'userId',
  'orderNumber',
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
] as const;

export const ordersConfig = {
  entity: 'orders',
  table: orders,
  operation: 'order.manage',
  mode: 'on-demand',
  filterable: ['statusId'],
  sortable: ['createdAt'],
  defaultOrder: { column: 'createdAt', direction: 'desc' },
  writable: ORDERS_WRITABLE,
  readonly: ORDERS_READONLY,
} as const;
