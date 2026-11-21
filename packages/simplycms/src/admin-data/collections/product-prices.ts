import { createCollection } from '@tanstack/react-db';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { ProductPrice } from 'simplycms/schema/types'; // 🔴 type-only
import { listProductPrices } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { onDemandCollectionOptions } from '../on-demand-options';
import { toSubsetPayload } from '../subset-payload';

/**
 * On-demand за товаром/модифікацією — БЕЗ `persistenceHandlers`:
 * набір цін пишеться атомарно `saveProductPrices`, не
 * фабричним insert/update/remove. `collection.insert()` тут кидає за
 * побудовою бібліотеки — це й потрібно, запис лише іменованою операцією;
 * write-back після `saveProductPrices` робить сторінка.
 */
function create(queryClient: QueryClient) {
  return createCollection(
    onDemandCollectionOptions<ProductPrice>({
      id: ENTITY.productPrices,
      queryClient,
      queryKey: collectionKey(ENTITY.productPrices),
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
