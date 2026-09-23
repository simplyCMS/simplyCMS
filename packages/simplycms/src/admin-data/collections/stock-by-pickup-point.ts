import { BTreeIndex, createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { StockByPickupPoint } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import { listStock } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { toSubsetPayload } from '../subset-payload';

/**
 * On-demand за товаром/модифікацією — БЕЗ `persistenceHandlers` (Е3-3):
 * ручний облік пишеться атомарно `saveStock` (Task 4/8) разом з гвардованим
 * переходом `stock_status`, не фабричним update. `collection.insert()`
 * тут кидає за побудовою бібліотеки — запис лише іменованою операцією.
 */
function create(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions<StockByPickupPoint>({
      id: ENTITY.stockByPickupPoint,
      queryClient,
      queryKey: collectionKey(ENTITY.stockByPickupPoint),
      syncMode: 'on-demand',
      autoIndex: 'eager',
      defaultIndexType: BTreeIndex,
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listStock({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<
              typeof toSubsetPayload
            >[0],
          ),
        }),
    }),
  );
}

export type StockCollection = ReturnType<typeof create>;
export const stockCollection: CollectionDef<StockCollection> = {
  id: ENTITY.stockByPickupPoint,
  create,
};
