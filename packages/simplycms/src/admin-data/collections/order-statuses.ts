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

const key = entityKey(ENTITY.orderStatuses);

/**
 * Довідник статусів — режим eager (К3-5): обмежений розмір, повна
 * колекція в памʼяті. 🔴 queryKey = entityKey(...).list() — той самий
 * префікс, що в решти запитів сутності (Б-2). schema НЕ передається
 * (К3-9′ п.3): тип — generic OrderStatus, рантайм-валідація — на сервері.
 */
function create(queryClient: QueryClient) {
  const collection = createCollection(
    queryCollectionOptions<OrderStatus>({
      id: ENTITY.orderStatuses,
      queryClient,
      queryKey: key.list(),
      getKey: (row) => row.id,
      queryFn: async () => listOrderStatuses({ data: {} }),

      onInsert: async ({ transaction }) => {
        // 🔴 batch: УСІ мутації транзакції (дефект [0] старої редакції).
        const drafts = transaction.mutations.map((m) => m.modified);
        const rows = await insertOrderStatuses({ data: drafts as never });
        // 🔴 Fail-loud ДО write-back: інакше в synced-store ляжуть ДВА
        // рядки — серверний під своїм ключем і оптимістичний під
        // клієнтським, що зникне на commit (урок favorites MetaHub).
        for (const [i, row] of rows.entries()) {
          if (row.id !== (drafts[i] as OrderStatus).id)
            throw new Error(
              `[admin-data] сервер повернув id "${row.id}" замість "${(drafts[i] as OrderStatus).id}" — write-back писав би не в той ключ`,
            );
        }
        collection.utils.writeBatch(() => {
          for (const row of rows) collection.utils.writeUpsert(row);
        });
        return { refetch: false };
      },

      onUpdate: async ({ transaction }) => {
        const patches = transaction.mutations.map((m) => ({
          id: m.key as string,
          patch: m.changes,
        }));
        const rows = await updateOrderStatuses({ data: patches as never });
        collection.utils.writeBatch(() => {
          for (const row of rows) collection.utils.writeUpsert(row);
        });
        return { refetch: false };
      },

      onDelete: async ({ transaction }) => {
        const ids = transaction.mutations.map((m) => ({ id: m.key as string }));
        await removeOrderStatuses({ data: ids as never });
        collection.utils.writeBatch(() => {
          for (const { id } of ids) collection.utils.writeDelete(id);
        });
        return { refetch: false };
      },
    }),
  );
  return collection;
}

export type OrderStatusesCollection = ReturnType<typeof create>;
export const orderStatusesCollection: CollectionDef<OrderStatusesCollection> = {
  id: ENTITY.orderStatuses,
  create,
};
