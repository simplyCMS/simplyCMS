import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { ShippingMethod } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertShippingMethods,
  listShippingMethods,
  removeShippingMethods,
  updateShippingMethods,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { invalidateShippingConsumers } from '../shipping-cache';

/** Способи доставки — eager (обмежений довідник). Remove — ІМЕНОВАНИЙ guarded removeShippingMethods (Е6а-22); 409 проходить як помилка транзакції, не ковтається. */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<ShippingMethod> } = {};
  const collection = createCollection(
    queryCollectionOptions<ShippingMethod>({
      id: ENTITY.shippingMethods,
      queryClient,
      queryKey: collectionKey(ENTITY.shippingMethods),
      getKey: (row) => row.id,
      queryFn: async () => listShippingMethods({ data: {} }),
      ...persistenceHandlers<ShippingMethod>(() => ref.current!, {
        entity: ENTITY.shippingMethods,
        insert: insertShippingMethods,
        update: updateShippingMethods,
        remove: removeShippingMethods,
        afterWrite: () => invalidateShippingConsumers(queryClient),
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type ShippingMethodsCollection = ReturnType<typeof create>;
export const shippingMethodsCollection: CollectionDef<ShippingMethodsCollection> =
  {
    id: ENTITY.shippingMethods,
    create,
  };
