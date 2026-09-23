import { BTreeIndex, createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import type { ModificationPropertyValue } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertModificationPropertyValues,
  listModificationPropertyValues,
  removeModificationPropertyValues,
  updateModificationPropertyValues,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { toSubsetPayload } from '../subset-payload';

const key = entityKey(ENTITY.modificationPropertyValues);

/**
 * On-demand за модифікацією (Task 7/9). Автозбереження UX-паритету
 * (Е3-11), multiselect — рядок на опцію (Е3-13), унікальність тримає БД.
 */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<ModificationPropertyValue> } = {};
  const collection = createCollection(
    queryCollectionOptions<ModificationPropertyValue>({
      id: ENTITY.modificationPropertyValues,
      queryClient,
      queryKey: key.list(),
      syncMode: 'on-demand',
      autoIndex: 'eager',
      defaultIndexType: BTreeIndex,
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listModificationPropertyValues({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<
              typeof toSubsetPayload
            >[0],
          ),
        }),
      ...persistenceHandlers<ModificationPropertyValue>(() => ref.current!, {
        entity: ENTITY.modificationPropertyValues,
        insert: insertModificationPropertyValues,
        update: updateModificationPropertyValues,
        remove: removeModificationPropertyValues,
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type ModificationPropertyValuesCollection = ReturnType<typeof create>;
export const modificationPropertyValuesCollection: CollectionDef<ModificationPropertyValuesCollection> =
  {
    id: ENTITY.modificationPropertyValues,
    create,
  };
