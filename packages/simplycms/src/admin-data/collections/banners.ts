import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { Banner } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertBanners,
  listBanners,
  removeBanners,
  updateBanners,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';

/** Банери — eager. Фабричний CRUD без побічних кешів (вітрина читає з БД). */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<Banner> } = {};
  const collection = createCollection(
    queryCollectionOptions<Banner>({
      id: ENTITY.banners,
      queryClient,
      queryKey: collectionKey(ENTITY.banners),
      getKey: (row) => row.id,
      queryFn: async () => listBanners({ data: {} }),
      ...persistenceHandlers<Banner>(() => ref.current!, {
        entity: ENTITY.banners,
        insert: insertBanners,
        update: updateBanners,
        remove: removeBanners,
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type BannersCollection = ReturnType<typeof create>;
export const bannersCollection: CollectionDef<BannersCollection> = {
  id: ENTITY.banners,
  create,
};
