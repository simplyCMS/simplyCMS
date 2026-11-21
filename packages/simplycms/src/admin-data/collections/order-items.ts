import { createCollection } from '@tanstack/react-db';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { OrderItem } from 'simplycms/schema/types'; // 🔴 type-only
import { listOrderItems } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { onDemandCollectionOptions } from '../on-demand-options';
import { toSubsetPayload } from '../subset-payload';

/**
 * Позиції замовлення — on-demand зріз `where orderId` картки, лише
 * на ЧИТАННЯ: редагування позицій — окремий етап, тож
 * `persistenceHandlers` немає й `collection.insert()` кидає. Ліміт сторінки
 * сервера — `maxLimit` 500.
 */
function create(queryClient: QueryClient) {
  return createCollection(
    onDemandCollectionOptions<OrderItem>({
      id: ENTITY.orderItems,
      queryClient,
      queryKey: collectionKey(ENTITY.orderItems),
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listOrderItems({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<
              typeof toSubsetPayload
            >[0],
          ),
        }),
    }),
  );
}

export type OrderItemsCollection = ReturnType<typeof create>;
export const orderItemsCollection: CollectionDef<OrderItemsCollection> = {
  id: ENTITY.orderItems,
  create,
};
