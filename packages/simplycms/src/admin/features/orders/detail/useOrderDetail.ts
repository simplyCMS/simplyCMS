import { eq, useLiveQuery } from '@tanstack/react-db';
import {
  orderItemsCollection,
  ordersCollection,
  useCollection,
} from 'simplycms/admin-data';

/**
 * Дані картки: рядок замовлення — зріз `where id`, позиції — зріз
 * `where orderId` (обидва on-demand, Е5-10). `isLoading` — доки зріз
 * замовлення не готовий: порожній результат ДО цього не «не знайдено».
 */
export function useOrderDetail(orderId: string) {
  const orders = useCollection(ordersCollection);
  const itemsCol = useCollection(orderItemsCollection);
  const { data: rows, isLoading } = useLiveQuery(
    (q) => q.from({ o: orders }).where(({ o }) => eq(o.id, orderId)),
    [orderId],
  );
  const { data: items } = useLiveQuery(
    (q) =>
      q
        .from({ i: itemsCol })
        .where(({ i }) => eq(i.orderId, orderId))
        .orderBy(({ i }) => i.createdAt, 'asc'),
    [orderId],
  );
  return { order: rows[0], items, isLoading };
}
