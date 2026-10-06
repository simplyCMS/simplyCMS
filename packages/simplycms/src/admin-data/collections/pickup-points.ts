import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { PickupPoint } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertPickupPoints,
  listPickupPoints,
  removePickupPoints,
  updatePickupPoints,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { invalidateShippingConsumers } from '../shipping-cache';

/** Точки видачі — eager. Remove — іменований guarded removePickupPoints. */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<PickupPoint> } = {};
  const collection = createCollection(
    queryCollectionOptions<PickupPoint>({
      id: ENTITY.pickupPoints,
      queryClient,
      queryKey: collectionKey(ENTITY.pickupPoints),
      getKey: (row) => row.id,
      queryFn: async () => listPickupPoints({ data: {} }),
      ...persistenceHandlers<PickupPoint>(() => ref.current!, {
        entity: ENTITY.pickupPoints,
        insert: insertPickupPoints,
        update: updatePickupPoints,
        remove: removePickupPoints,
        afterWrite: () => invalidateShippingConsumers(queryClient),
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type PickupPointsCollection = ReturnType<typeof create>;
export const pickupPointsCollection: CollectionDef<PickupPointsCollection> = {
  id: ENTITY.pickupPoints,
  create,
};
