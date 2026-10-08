/**
 * «Сервер» замовлень для `orders-collections.test.tsx` — за контрактом
 * `admin-server/impl/resource.ts` (list): фільтри eq/in, сортування
 * subset-у, ДАЛІ тай-брейкер `id asc` (Е3-8), межа `min(limit ?? max, max)`
 * (Е5-12), offset. Стаб ФІЛЬТРУЄ фікстуру, а не віддає все будь-кому —
 * інакше зрізи `where` і сторінки були б неперевірними.
 *
 * 🔴 Postgres не гарантує порядку рівних ключів без тай-брейкера; стаб
 * відтворює це, РОЗВЕРТАЮЧИ вхідний масив на кожному другому виклику. Тож
 * без тай-брейкера рівні `createdAt` реально перемішуються між сторінками —
 * саме це й ловить тест Review Focus 5.
 */
import { vi } from 'vitest';
import type { AdminOrder } from '../../collections/orders';
import type { OrderItem } from 'simplycms/schema/types';
import { applySubset, type Payload } from './mutable-server';

export const server = { orders: [] as AdminOrder[], items: [] as OrderItem[] };
let calls = 0;

/** За контрактом сервера (мутабельний `applySubset`, копії, gt/gte/lt/lte). */
function list<R extends { id: string }>(src: R[], data: Payload, max: number) {
  // Порядок рівних ключів без тай-брейкера недетермінований — розвертаємо.
  const input = calls++ % 2 ? [...src].reverse() : src;
  return applySubset(input, data, max);
}

/**
 * Застосувати відповідь мутації ({ order, upserted, removedIds }) до стану
 * «сервера»: після запису ревалідація (TSDB-1) віддасть саме його. Мок
 * мутації викликає це ВСЕРЕДИНІ реалізації і повертає той самий об'єкт.
 * Збережені об'єкти — безпечні для спільних посилань: кожне читання
 * копіює рядки через `applySubset`.
 */
export function applyOutcome<
  T extends {
    order?: AdminOrder;
    upserted?: OrderItem[];
    removedIds?: string[];
  },
>(out: T): T {
  const order = out.order;
  if (order)
    server.orders = server.orders.map((r) => (r.id === order.id ? order : r));
  for (const u of out.upserted ?? [])
    server.items = [...server.items.filter((i) => i.id !== u.id), u];
  server.items = server.items.filter(
    (i) => !(out.removedIds ?? []).includes(i.id),
  );
  return out;
}

export const listOrders = vi.fn(async ({ data }: { data: Payload }) =>
  list(server.orders, data, 100),
);
export const listOrderItems = vi.fn(async ({ data }: { data: Payload }) =>
  list(server.items, data, 500),
);

export function makeOrder(
  n: number,
  createdAt: Date,
  statusId = 's-new',
): AdminOrder {
  return {
    id: `o${String(n).padStart(4, '0')}`,
    userId: null,
    orderNumber: `N-${n}`,
    statusId,
    firstName: 'Ім’я',
    lastName: 'Прізвище',
    email: `c${n}@example.test`,
    phone: '+380000000000',
    deliveryAddress: null,
    deliveryCity: null,
    paymentMethod: 'cash',
    subtotal: '100.00',
    total: '100.00',
    notes: null,
    createdAt,
    updatedAt: createdAt,
    shippingMethodId: null,
    shippingZoneId: null,
    shippingRateId: null,
    shippingCost: '0',
    pickupPointId: null,
    shippingData: {},
    hasDifferentRecipient: false,
    recipientFirstName: null,
    recipientLastName: null,
    recipientPhone: null,
    recipientEmail: null,
    savedRecipientId: null,
    savedAddressId: null,
    personalDataErasedAt: null,
  } satisfies AdminOrder;
}

export function reset(orders: AdminOrder[], items: OrderItem[] = []) {
  server.orders = orders;
  server.items = items;
  calls = 0;
  listOrders.mockClear();
  listOrderItems.mockClear();
}
