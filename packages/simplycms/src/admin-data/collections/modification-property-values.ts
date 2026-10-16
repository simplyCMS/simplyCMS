import { createCollection } from '@tanstack/react-db';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { ModificationPropertyValue } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import { listModificationPropertyValues } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { onDemandCollectionOptions } from '../on-demand-options';
import { toSubsetPayload } from '../subset-payload';

/**
 * On-demand за модифікацією. ЛИШЕ ЧИТАННЯ (М1, Task 13): значення пишуться
 * командою агрегата `products.saveDescription`.
 */
function create(queryClient: QueryClient) {
  const collection = createCollection(
    onDemandCollectionOptions<ModificationPropertyValue>({
      id: ENTITY.modificationPropertyValues,
      queryClient,
      queryKey: collectionKey(ENTITY.modificationPropertyValues),
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listModificationPropertyValues({
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

export type ModificationPropertyValuesCollection = ReturnType<typeof create>;
export const modificationPropertyValuesCollection: CollectionDef<ModificationPropertyValuesCollection> =
  {
    id: ENTITY.modificationPropertyValues,
    create,
  };
