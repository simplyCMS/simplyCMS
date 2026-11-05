import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { OrderStatus } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import { listOrderStatuses } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';

/**
 * Довідник статусів — режим eager (К3-5): обмежений розмір, повна
 * колекція в памʼяті. 🔴 queryKey = collectionKey(...) — той самий
 * префікс, що в решти запитів сутності (Б-2). schema НЕ передається
 * (К3-9′ п.3): тип — generic OrderStatus, рантайм-валідація — на сервері.
 * ЛИШЕ ЧИТАННЯ (М2б, Р19): запис — команди агрегата `order-statuses.*` (версія, переклади),
 * не узагальнений запис колекції.
 */
function create(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions<OrderStatus>({
      id: ENTITY.orderStatuses,
      queryClient,
      queryKey: collectionKey(ENTITY.orderStatuses),
      getKey: (row) => row.id,
      queryFn: async () => listOrderStatuses({ data: {} }),
    }),
  );
}

export type OrderStatusesCollection = ReturnType<typeof create>;
export const orderStatusesCollection: CollectionDef<OrderStatusesCollection> = {
  id: ENTITY.orderStatuses,
  create,
};
