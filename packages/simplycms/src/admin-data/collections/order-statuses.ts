import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import type { OrderStatus } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertOrderStatuses,
  listOrderStatuses,
  removeOrderStatuses,
  updateOrderStatuses,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';

const key = entityKey(ENTITY.orderStatuses);

/**
 * Довідник статусів — режим eager (К3-5): обмежений розмір, повна
 * колекція в памʼяті. 🔴 queryKey = entityKey(...).list() — той самий
 * префікс, що в решти запитів сутності (Б-2). schema НЕ передається
 * (К3-9′ п.3): тип — generic OrderStatus, рантайм-валідація — на сервері.
 * Persistence — спільний канон `persistenceHandlers` (Task 5): перша
 * колекція на ньому, `order-statuses-collection.test.ts` лишається
 * зеленим БЕЗ правок — доказ еквівалентності поведінки.
 */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<OrderStatus> } = {};
  const collection = createCollection(
    queryCollectionOptions<OrderStatus>({
      id: ENTITY.orderStatuses,
      queryClient,
      queryKey: key.list(),
      getKey: (row) => row.id,
      queryFn: async () => listOrderStatuses({ data: {} }),
      ...persistenceHandlers<OrderStatus>(() => ref.current!, {
        entity: ENTITY.orderStatuses,
        insert: insertOrderStatuses,
        update: updateOrderStatuses,
        remove: removeOrderStatuses,
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type OrderStatusesCollection = ReturnType<typeof create>;
export const orderStatusesCollection: CollectionDef<OrderStatusesCollection> = {
  id: ENTITY.orderStatuses,
  create,
};
