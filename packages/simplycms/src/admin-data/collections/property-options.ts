import { createCollection } from '@tanstack/react-db';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { PropertyOption } from 'simplycms/schema/types'; // 🔴 type-only
import {
  insertPropertyOptions,
  listPropertyOptions,
  removePropertyOptions,
  updatePropertyOptions,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { onDemandCollectionOptions } from '../on-demand-options';
import { toSubsetPayload } from '../subset-payload';

/**
 * Довідник опцій характеристик — зріз по `propertyId` для multiselect/
 * скалярних значень товару й модифікації. Запис
 * через канон `persistenceHandlers`; on-demand лишається.
 */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<PropertyOption> } = {};
  const collection = createCollection(
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
      ...persistenceHandlers<PropertyOption>(() => ref.current!, {
        entity: ENTITY.propertyOptions,
        insert: insertPropertyOptions,
        update: updatePropertyOptions,
        remove: removePropertyOptions,
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type PropertyOptionsCollection = ReturnType<typeof create>;
export const propertyOptionsCollection: CollectionDef<PropertyOptionsCollection> =
  {
    id: ENTITY.propertyOptions,
    create,
  };
