import { createCollection } from '@tanstack/react-db';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import { listProductModifications } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { onDemandCollectionOptions } from '../on-demand-options';
import { toSubsetPayload } from '../subset-payload';

/** Рядок колекції — read-model ресурсу (назва з перекладу основної мови; без `slug`). */
export type ProductModificationReadRow = Awaited<
  ReturnType<typeof listProductModifications>
>[number];

/**
 * On-demand за товаром. ЛИШЕ ЧИТАННЯ (М1, Task 13): запис модифікацій іде
 * командою агрегата `products.saveDescription`; колекція дає таблиці картки
 * статус наявності й ціну, а селекторам (знижки, замовлення) — назви.
 */
function create(queryClient: QueryClient) {
  const collection = createCollection(
    onDemandCollectionOptions<ProductModificationReadRow>({
      id: ENTITY.productModifications,
      queryClient,
      queryKey: collectionKey(ENTITY.productModifications),
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listProductModifications({
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

export type ProductModificationsCollection = ReturnType<typeof create>;
export const productModificationsCollection: CollectionDef<ProductModificationsCollection> =
  {
    id: ENTITY.productModifications,
    create,
  };
