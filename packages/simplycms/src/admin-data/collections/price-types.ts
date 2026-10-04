import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { PriceType } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertPriceTypes,
  listPriceTypes,
  removePriceTypes,
  updatePriceTypes,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';

/**
 * Довідник типів цін: читання — Е3-1 (картка товару), запис — Е4 (Task 5)
 * через канон `persistenceHandlers`. Eager — обмежений розмір (Е4-9).
 * 🔴 `remove` = `removePriceTypes` — ІМЕНОВАНИЙ guarded-серверFn (Е4-2:
 * «не видалити дефолтний» під advisory-lock), фабричного remove для типів
 * цін немає; відмова сервера відкочує оптимістичне видалення. Дефолт
 * ставить окремий `setDefaultPriceType` — не через `update` колекції
 * (`isDefault` readonly для фабрики).
 */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<PriceType> } = {};
  const collection = createCollection(
    queryCollectionOptions<PriceType>({
      id: ENTITY.priceTypes,
      queryClient,
      queryKey: collectionKey(ENTITY.priceTypes),
      getKey: (row) => row.id,
      queryFn: async () => listPriceTypes({ data: {} }),
      ...persistenceHandlers<PriceType>(() => ref.current!, {
        entity: ENTITY.priceTypes,
        insert: insertPriceTypes,
        update: updatePriceTypes,
        remove: removePriceTypes,
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type PriceTypesCollection = ReturnType<typeof create>;
export const priceTypesCollection: CollectionDef<PriceTypesCollection> = {
  id: ENTITY.priceTypes,
  create,
};
