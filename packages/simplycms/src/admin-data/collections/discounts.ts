import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { Discount } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import { listDiscounts, removeDiscounts } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { invalidateDiscountConsumers } from '../discount-cache';

/**
 * Знижки — eager, лише `remove`. Запис іде атомарним `saveDiscount` (знижка +
 * цілі + умови) через `writeBatch(writeUpsert)` у хуку UI (Е6в-16), тож
 * insert/update у колекції немає за побудовою.
 */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<Discount> } = {};
  const collection = createCollection(
    queryCollectionOptions<Discount>({
      id: ENTITY.discounts,
      queryClient,
      queryKey: collectionKey(ENTITY.discounts),
      getKey: (row) => row.id,
      queryFn: async () => listDiscounts({ data: {} }),
      ...persistenceHandlers<Discount>(() => ref.current!, {
        entity: ENTITY.discounts,
        remove: removeDiscounts,
        afterWrite: () => invalidateDiscountConsumers(queryClient),
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type DiscountsCollection = ReturnType<typeof create>;
export const discountsCollection: CollectionDef<DiscountsCollection> = {
  id: ENTITY.discounts,
  create,
};
