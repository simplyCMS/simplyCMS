import { BTreeIndex, createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { Product } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertProducts,
  listProducts,
  removeProducts,
  updateProducts,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { toSubsetPayload } from '../subset-payload';

/**
 * Каталог росте — on-demand (К3-5): у памʼяті лише зрізи, які реально
 * запитав живий запит (сторінка списку, картка за id). `queryKey`
 * статичний `collectionKey(...)` — demand-суфікс дописує бібліотека, префікс
 * лишається спільним для всіх зрізів (Б-2). `preload()` на такій
 * колекції — no-op: прогрів роуту робиться live-query (Task 6).
 */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<Product> } = {};
  const collection = createCollection(
    queryCollectionOptions<Product>({
      id: ENTITY.products,
      queryClient,
      queryKey: collectionKey(ENTITY.products),
      syncMode: 'on-demand',
      // 🔴 Е3-16: список гортає useLiveInfiniteQuery — без індексу
      // сортування друга сторінка не запитується (виміряно спайком).
      autoIndex: 'eager',
      defaultIndexType: BTreeIndex,
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listProducts({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<
              typeof toSubsetPayload
            >[0],
          ),
        }),
      ...persistenceHandlers<Product>(() => ref.current!, {
        entity: ENTITY.products,
        insert: insertProducts,
        update: updateProducts,
        remove: removeProducts,
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type ProductsCollection = ReturnType<typeof create>;
export const productsCollection: CollectionDef<ProductsCollection> = {
  id: ENTITY.products,
  create,
};
