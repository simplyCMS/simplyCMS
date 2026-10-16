import { createCollection } from '@tanstack/react-db';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { Product } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import { listProducts } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { onDemandCollectionOptions } from '../on-demand-options';
import { toSubsetPayload } from '../subset-payload';

/**
 * Каталог росте — on-demand (К3-5): у памʼяті лише зрізи, які реально
 * запитав живий запит (сторінка списку, картка за id). `queryKey`
 * статичний `collectionKey(...)` — demand-суфікс дописує бібліотека, префікс
 * лишається спільним для всіх зрізів (Б-2). `preload()` на такій
 * колекції — no-op: прогрів роуту робиться live-query (Task 6).
 * ЛИШЕ ЧИТАННЯ (М1, Task 13): створення, правки й видалення товару — команди
 * агрегата (`products.create/saveDescription/remove`), без persistence-хендлерів.
 */
function create(queryClient: QueryClient) {
  const collection = createCollection(
    onDemandCollectionOptions<Product>({
      id: ENTITY.products,
      queryClient,
      queryKey: collectionKey(ENTITY.products),
      // 🔴 Е3-16: список гортає useLiveInfiniteQuery — без індексу
      // сторінки йдуть префіксом без offset (TSDB-2, кейс 2б контракту).
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listProducts({
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

export type ProductsCollection = ReturnType<typeof create>;
export const productsCollection: CollectionDef<ProductsCollection> = {
  id: ENTITY.products,
  create,
};
