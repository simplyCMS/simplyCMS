/**
 * Спільне налаштування тестів колекцій замовлень (Task 5 Е5): один
 * QueryClient, справжні колекції з реєстру, live-сторінки списку.
 * 🔴 `vi.mock('simplycms/admin-server', …)` лишається в КОЖНОМУ тест-файлі.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLiveInfiniteQuery } from '@tanstack/react-db';
import type { ReactNode } from 'react';
import { getCollection } from '../../registry';
import { ordersCollection } from '../../collections/orders';
import { orderItemsCollection } from '../../collections/order-items';

// Значення ORDERS_PAGE_SIZE (Е5-14): константу оголошує Task 6 в
// `admin/features/orders/list` (T5), а admin-data (T4) імпортувати звідти
// не може. Інваріант `ORDERS_PAGE_SIZE + 1 <= maxLimit` стереже тест Task 6.
export const PAGE = 50;
export const SAME = new Date('2026-10-01T10:00:00Z');

export function setup() {
  const qc = new QueryClient();
  const orders = getCollection(qc, ordersCollection);
  const items = getCollection(qc, orderItemsCollection);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const usePages = (pageSize: number) =>
    useLiveInfiniteQuery(
      (q) => q.from({ o: orders }).orderBy(({ o }) => o.createdAt, 'desc'),
      { pageSize },
    );
  return { orders, items, wrapper, usePages };
}

export const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id);
