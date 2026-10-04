import { eq, useLiveInfiniteQuery } from '@tanstack/react-db';
import {
  orderStatusesCollection,
  ordersCollection,
  useCollection,
} from 'simplycms/admin-data';

/**
 * Розмір сторінки списку (Е5-14). 🔴 `useLiveInfiniteQuery` просить
 * `pageSize + 1` рядків (peek-ahead), а серверний `maxLimit` замовлень — 100:
 * інваріант `ORDERS_PAGE_SIZE + 1 <= maxLimit` стереже `tests/orders-page-size.test.ts`.
 */
export const ORDERS_PAGE_SIZE = 50;

export interface OrdersFilters {
  readonly statusId?: string;
}

/**
 * Сторінка списку замовлень — on-demand зріз: фільтр статусу йде push-down
 * (eq), статус підтягується join-ом з eager-довідника. «Показати ще» —
 * offset + peek-ahead бібліотеки; текстового пошуку немає (П6).
 * Порядок `createdAt desc` + тай-брейкер `id` забезпечує сервер (Е3-8).
 */
export function useOrdersList(filters: OrdersFilters) {
  const orders = useCollection(ordersCollection);
  const statuses = useCollection(orderStatusesCollection);
  return useLiveInfiniteQuery(
    (q) => {
      let query = q
        .from({ o: orders })
        .leftJoin({ s: statuses }, ({ o, s }) => eq(o.statusId, s.id));
      if (filters.statusId)
        query = query.where(({ o }) => eq(o.statusId, filters.statusId!));
      return query
        .orderBy(({ o }) => o.createdAt, 'desc')
        .select(({ o, s }) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          firstName: o.firstName,
          lastName: o.lastName,
          email: o.email,
          total: o.total,
          createdAt: o.createdAt,
          statusName: s?.name,
          statusColor: s?.color,
        }));
    },
    { pageSize: ORDERS_PAGE_SIZE },
    [filters.statusId],
  );
}
