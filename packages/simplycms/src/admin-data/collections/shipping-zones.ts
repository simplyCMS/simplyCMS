import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { ShippingZone } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertShippingZones,
  listShippingZones,
  removeShippingZones,
  updateShippingZones,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { invalidateShippingConsumers } from '../shipping-cache';

/** Зони доставки — eager. Remove — іменований guarded removeShippingZones; дефолтну зону ставить setDefaultShippingZone, не update колекції. */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<ShippingZone> } = {};
  const collection = createCollection(
    queryCollectionOptions<ShippingZone>({
      id: ENTITY.shippingZones,
      queryClient,
      queryKey: collectionKey(ENTITY.shippingZones),
      getKey: (row) => row.id,
      queryFn: async () => listShippingZones({ data: {} }),
      ...persistenceHandlers<ShippingZone>(() => ref.current!, {
        entity: ENTITY.shippingZones,
        insert: insertShippingZones,
        update: updateShippingZones,
        remove: removeShippingZones,
        afterWrite: () => invalidateShippingConsumers(queryClient),
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type ShippingZonesCollection = ReturnType<typeof create>;
export const shippingZonesCollection: CollectionDef<ShippingZonesCollection> = {
  id: ENTITY.shippingZones,
  create,
};
