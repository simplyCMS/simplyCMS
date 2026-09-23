import { createCollection } from '@tanstack/react-db';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { PropertyOption } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import { listPropertyOptions } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { onDemandCollectionOptions } from '../on-demand-options';
import { toSubsetPayload } from '../subset-payload';

/**
 * Довідник на ЧИТАННЯ (Е3-1): опції характеристик — зріз по `propertyId`
 * для multiselect/скалярних значень товару й модифікації. CRUD — Е4.
 * БЕЗ `persistenceHandlers`.
 */
function create(queryClient: QueryClient) {
  return createCollection(
    onDemandCollectionOptions<PropertyOption>({
      id: ENTITY.propertyOptions,
      queryClient,
      queryKey: collectionKey(ENTITY.propertyOptions),
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listPropertyOptions({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<
              typeof toSubsetPayload
            >[0],
          ),
        }),
    }),
  );
}

export type PropertyOptionsCollection = ReturnType<typeof create>;
export const propertyOptionsCollection: CollectionDef<PropertyOptionsCollection> =
  {
    id: ENTITY.propertyOptions,
    create,
  };
