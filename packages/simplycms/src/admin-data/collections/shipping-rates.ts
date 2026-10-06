import { createCollection } from '@tanstack/react-db';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { ShippingRate } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertShippingRates,
  listShippingRates,
  removeShippingRates,
  updateShippingRates,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { invalidateShippingConsumers } from '../shipping-cache';
import { onDemandCollectionOptions } from '../on-demand-options';
import { toSubsetPayload } from '../subset-payload';

/** Тарифи — on-demand зріз по methodId/zoneId (їх багато). Remove — generic фабричний (Е6а-22). */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<ShippingRate> } = {};
  const collection = createCollection(
    onDemandCollectionOptions<ShippingRate>({
      id: ENTITY.shippingRates,
      queryClient,
      queryKey: collectionKey(ENTITY.shippingRates),
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listShippingRates({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<
              typeof toSubsetPayload
            >[0],
          ),
        }),
      ...persistenceHandlers<ShippingRate>(() => ref.current!, {
        entity: ENTITY.shippingRates,
        insert: insertShippingRates,
        update: updateShippingRates,
        remove: removeShippingRates,
        afterWrite: () => invalidateShippingConsumers(queryClient),
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type ShippingRatesCollection = ReturnType<typeof create>;
export const shippingRatesCollection: CollectionDef<ShippingRatesCollection> = {
  id: ENTITY.shippingRates,
  create,
};
