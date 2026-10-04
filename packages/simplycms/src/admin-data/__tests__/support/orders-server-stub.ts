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

type Filter = { field: string[]; operator: string; value: unknown };
type Sort = { field: string[]; direction: 'asc' | 'desc' };
type Payload = {
  subset?: {
    filters?: Filter[];
    sorts?: Sort[];
    limit?: number;
    offset?: number;
  };
};

export const server = { orders: [] as AdminOrder[], items: [] as OrderItem[] };
let calls = 0;

const val = (r: object, f: string[]) =>
  (r as Record<string, unknown>)[f.join('.')];
const cmp = (a: unknown, b: unknown) => {
  const av = a instanceof Date ? a.getTime() : (a as string | number);
  const bv = b instanceof Date ? b.getTime() : (b as string | number);
  return av < bv ? -1 : av > bv ? 1 : 0;
};

function list<R extends { id: string }>(src: R[], data: Payload, max: number) {
  let out = calls++ % 2 ? [...src].reverse() : [...src];
  for (const f of data.subset?.filters ?? [])
    out = out.filter((r) => {
      const v = val(r, f.field);
      if (f.operator === 'eq') return v === f.value;
      if (f.operator === 'in') return (f.value as unknown[]).includes(v);
      throw new Error(`стаб: оператор ${f.operator} поза контрактом`);
    });
  const sorts = data.subset?.sorts ?? [];
  out.sort((a, b) => {
    for (const s of sorts) {
      const c = cmp(val(a, s.field), val(b, s.field));
      if (c !== 0) return s.direction === 'desc' ? -c : c;
    }
    return cmp(a.id, b.id); // тай-брейкер сервера (Е3-8)
  });
  const off = data.subset?.offset ?? 0;
  const lim = Math.min(data.subset?.limit ?? max, max);
  return out.slice(off, off + lim);
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
    deliveryMethod: null,
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
  } satisfies AdminOrder;
}

export function reset(orders: AdminOrder[], items: OrderItem[] = []) {
  server.orders = orders;
  server.items = items;
  calls = 0;
  listOrders.mockClear();
  listOrderItems.mockClear();
}
