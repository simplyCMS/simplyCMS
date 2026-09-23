import { BTreeIndex, createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import type { ProductModification } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertProductModifications,
  listProductModifications,
  removeProductModifications,
  updateProductModifications,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { toSubsetPayload } from '../subset-payload';

const key = entityKey(ENTITY.productModifications);

/**
 * On-demand за товаром — картка товару читає зріз `productId eq` (Task 7).
 * 🔴 Дефолт і порядок — ІМЕНОВАНІ операції (`setDefaultProductModification`,
 * `reorderProductModification`, Task 4), не фабричний insert/update: тут
 * лише базовий CRUD.
 */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<ProductModification> } = {};
  const collection = createCollection(
    queryCollectionOptions<ProductModification>({
      id: ENTITY.productModifications,
      queryClient,
      queryKey: key.list(),
      syncMode: 'on-demand',
      autoIndex: 'eager',
      defaultIndexType: BTreeIndex,
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listProductModifications({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<
              typeof toSubsetPayload
            >[0],
          ),
        }),
      ...persistenceHandlers<ProductModification>(() => ref.current!, {
        entity: ENTITY.productModifications,
        insert: insertProductModifications,
        update: updateProductModifications,
        remove: removeProductModifications,
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type ProductModificationsCollection = ReturnType<typeof create>;
export const productModificationsCollection: CollectionDef<ProductModificationsCollection> =
  {
    id: ENTITY.productModifications,
    create,
  };
