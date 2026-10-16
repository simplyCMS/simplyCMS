import { createCollection } from '@tanstack/react-db';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { ProductPropertyValue } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import { listProductPropertyValues } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { onDemandCollectionOptions } from '../on-demand-options';
import { toSubsetPayload } from '../subset-payload';

/**
 * On-demand за товаром. ЛИШЕ ЧИТАННЯ (М1, Task 13): значення пишуться
 * командою агрегата `products.saveDescription` разом з рештою картки.
 */
function create(queryClient: QueryClient) {
  const collection = createCollection(
    onDemandCollectionOptions<ProductPropertyValue>({
      id: ENTITY.productPropertyValues,
      queryClient,
      queryKey: collectionKey(ENTITY.productPropertyValues),
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listProductPropertyValues({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<
              typeof toSubsetPayload
            >[0],
          ),
        }),
    }),
  );
  return collection;
}

export type ProductPropertyValuesCollection = ReturnType<typeof create>;
export const productPropertyValuesCollection: CollectionDef<ProductPropertyValuesCollection> =
  {
    id: ENTITY.productPropertyValues,
    create,
  };
