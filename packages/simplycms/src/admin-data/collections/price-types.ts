import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import type { PriceType } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import { listPriceTypes } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';

const key = entityKey(ENTITY.priceTypes);

/**
 * Довідник на ЧИТАННЯ (Е3-1): картка товару потребує тип ціни, CRUD типів
 * — Е4. Eager — обмежений розмір; БЕЗ `persistenceHandlers`.
 * 🔴 Спільний префікс з Е4 — див. `sections.ts`.
 */
function create(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions<PriceType>({
      id: ENTITY.priceTypes,
      queryClient,
      queryKey: key.list(),
      getKey: (row) => row.id,
      queryFn: async () => listPriceTypes({ data: {} }),
    }),
  );
}

export type PriceTypesCollection = ReturnType<typeof create>;
export const priceTypesCollection: CollectionDef<PriceTypesCollection> = {
  id: ENTITY.priceTypes,
  create,
};
