import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { CategoryRule } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertCategoryRules,
  listCategoryRules,
  removeCategoryRules,
  updateCategoryRules,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { invalidateDiscountConsumers } from '../discount-cache';

/** Автоправила категорій — eager. Remove — фабричний removeCategoryRules; запуск — runCategoryRules (хук UI). */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<CategoryRule> } = {};
  const collection = createCollection(
    queryCollectionOptions<CategoryRule>({
      id: ENTITY.categoryRules,
      queryClient,
      queryKey: collectionKey(ENTITY.categoryRules),
      getKey: (row) => row.id,
      queryFn: async () => listCategoryRules({ data: {} }),
      ...persistenceHandlers<CategoryRule>(() => ref.current!, {
        entity: ENTITY.categoryRules,
        insert: insertCategoryRules,
        update: updateCategoryRules,
        remove: removeCategoryRules,
        afterWrite: () => invalidateDiscountConsumers(queryClient),
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type CategoryRulesCollection = ReturnType<typeof create>;
export const categoryRulesCollection: CollectionDef<CategoryRulesCollection> = {
  id: ENTITY.categoryRules,
  create,
};
