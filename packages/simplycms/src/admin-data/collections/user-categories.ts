import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { UserCategory } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertUserCategories,
  listUserCategories,
  removeUserCategories,
  updateUserCategories,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { invalidateDiscountConsumers } from '../discount-cache';

/** Категорії покупців — eager. Remove — guarded removeUserCategories (Е6в-18), дефолт — setDefaultUserCategory, не update колекції. */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<UserCategory> } = {};
  const collection = createCollection(
    queryCollectionOptions<UserCategory>({
      id: ENTITY.userCategories,
      queryClient,
      queryKey: collectionKey(ENTITY.userCategories),
      getKey: (row) => row.id,
      queryFn: async () => listUserCategories({ data: {} }),
      ...persistenceHandlers<UserCategory>(() => ref.current!, {
        entity: ENTITY.userCategories,
        insert: insertUserCategories,
        update: updateUserCategories,
        remove: removeUserCategories,
        afterWrite: () => invalidateDiscountConsumers(queryClient),
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type UserCategoriesCollection = ReturnType<typeof create>;
export const userCategoriesCollection: CollectionDef<UserCategoriesCollection> =
  {
    id: ENTITY.userCategories,
    create,
  };
