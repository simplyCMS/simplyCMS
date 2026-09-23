import { createCollection } from '@tanstack/react-db';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { ProductPropertyValue } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertProductPropertyValues,
  listProductPropertyValues,
  removeProductPropertyValues,
  updateProductPropertyValues,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { onDemandCollectionOptions } from '../on-demand-options';
import { toSubsetPayload } from '../subset-payload';

/**
 * On-demand за товаром (Task 7/9). Автозбереження UX-паритету (Е3-11):
 * кожна зміна — оптимістичний `collection.insert/update` фабричних
 * операцій; multiselect — рядок на опцію (Е3-13), унікальність тримає БД.
 */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<ProductPropertyValue> } = {};
  const collection = createCollection(
    onDemandCollectionOptions<ProductPropertyValue>({
      id: ENTITY.productPropertyValues,
      queryClient,
      queryKey: collectionKey(ENTITY.productPropertyValues),
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listProductPropertyValues({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<
              typeof toSubsetPayload
            >[0],
          ),
        }),
      ...persistenceHandlers<ProductPropertyValue>(() => ref.current!, {
        entity: ENTITY.productPropertyValues,
        insert: insertProductPropertyValues,
        update: updateProductPropertyValues,
        remove: removeProductPropertyValues,
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type ProductPropertyValuesCollection = ReturnType<typeof create>;
export const productPropertyValuesCollection: CollectionDef<ProductPropertyValuesCollection> =
  {
    id: ENTITY.productPropertyValues,
    create,
  };
