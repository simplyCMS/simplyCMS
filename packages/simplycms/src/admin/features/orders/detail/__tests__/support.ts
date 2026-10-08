import type { OrderItem } from 'simplycms/schema/types';

export const NEW = {
  id: 's-new',
  code: 'new',
  name: 'Нове',
  color: '#112233',
  sortOrder: 0,
};
export const DONE = {
  id: 's-done',
  code: 'done',
  name: 'Виконано',
  color: '#445566',
  sortOrder: 1,
};
export const CANCELLED = {
  id: 's-canc',
  code: 'cancelled',
  name: 'Скасоване',
  color: '#778899',
  sortOrder: 2,
};

/** Позиція замовлення `o0001`; `n` — порядковий номер (id, назва, час). */
export function makeItem(n: number, over: Partial<OrderItem> = {}): OrderItem {
  return {
    id: `i${String(n).padStart(4, '0')}`,
    orderId: 'o0001',
    productId: null,
    modificationId: null,
    name: `Товар ${n}`,
    price: '100.00',
    quantity: 1,
    total: '100.00',
    createdAt: new Date(Date.UTC(2026, 9, 1, 10, 0, n)),
    basePrice: null,
    discountData: null,
    stockPointId: null,
    stockReserved: 0,
    ...over,
  };
}
