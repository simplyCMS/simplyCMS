import { BTreeIndex, createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { ProductPrice } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import { listProductPrices } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { toSubsetPayload } from '../subset-payload';

/**
 * On-demand за товаром/модифікацією — БЕЗ `persistenceHandlers` (Е3-10):
 * набір цін пишеться атомарно `saveProductPrices` (Task 4/8), не
 * фабричним insert/update/remove. `collection.insert()` тут кидає за
 * побудовою бібліотеки — це й потрібно, запис лише іменованою операцією;
 * write-back після `saveProductPrices` робить сторінка (Task 8).
 */
function create(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions<ProductPrice>({
      id: ENTITY.productPrices,
      queryClient,
      queryKey: collectionKey(ENTITY.productPrices),
      syncMode: 'on-demand',
      autoIndex: 'eager',
      defaultIndexType: BTreeIndex,
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listProductPrices({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<
              typeof toSubsetPayload
            >[0],
          ),
        }),
    }),
  );
}

export type ProductPricesCollection = ReturnType<typeof create>;
export const productPricesCollection: CollectionDef<ProductPricesCollection> = {
  id: ENTITY.productPrices,
  create,
};
