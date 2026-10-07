import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { DiscountGroup } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertDiscountGroups,
  listDiscountGroups,
  removeDiscountGroups,
  updateDiscountGroups,
} from 'simplycms/admin-server';
import { getCollection, type CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { invalidateDiscountConsumers } from '../discount-cache';
import { discountsCollection } from './discounts';

/**
 * Групи знижок — eager. Insert/update — фабричні; видалення — ЛИШЕ
 * іменований `removeDiscountGroups` під локом (фабричний remove груп без
 * лока не використовується), тож `onDelete` тут власний, а не з
 * `persistenceHandlers`: сервер видаляє ВСЕ піддерево, і відповідь `removed`
 * несе id усіх груп — write-back прибирає їх, а не лише запитані.
 */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<DiscountGroup> } = {};
  const collection = createCollection(
    queryCollectionOptions<DiscountGroup>({
      id: ENTITY.discountGroups,
      queryClient,
      queryKey: collectionKey(ENTITY.discountGroups),
      getKey: (row) => row.id,
      queryFn: async () => listDiscountGroups({ data: {} }),
      ...persistenceHandlers<DiscountGroup>(() => ref.current!, {
        entity: ENTITY.discountGroups,
        insert: insertDiscountGroups,
        update: updateDiscountGroups,
        afterWrite: () => invalidateDiscountConsumers(queryClient),
      }),
      onDelete: async ({ transaction }) => {
        const { removed } = await removeDiscountGroups({
          data: transaction.mutations.map((m) => ({ id: m.key as string })),
        });
        ref.current!.utils.writeBatch(() => {
          for (const id of removed) ref.current!.utils.writeDelete(id);
        });
        dropCascadedDiscounts(queryClient, new Set(removed));
        await invalidateDiscountConsumers(queryClient);
        return { refetch: false };
      },
    }),
  );
  ref.current = collection;
  return collection;
}

/**
 * Каскад БД видалив знижки піддерева — прибираємо їх із колекції знижок
 * write-back-ом (без мережі, К3-7), рядки беремо з неї ж за `groupId`.
 * Колекція ще не завантажена — write-back неможливий, але й осиротілих
 * рядків у ній немає; точковий refetch лише скасовує запит, що летить.
 */
function dropCascadedDiscounts(queryClient: QueryClient, groups: Set<string>) {
  const discounts = getCollection(queryClient, discountsCollection);
  if (discounts.status !== 'ready') {
    void queryClient.invalidateQueries({
      queryKey: collectionKey(ENTITY.discounts),
    });
    return;
  }
  const ids = [...discounts.values()]
    .filter((d) => groups.has(d.groupId))
    .map((d) => d.id);
  if (ids.length === 0) return;
  discounts.utils.writeBatch(() => {
    for (const id of ids) discounts.utils.writeDelete(id);
  });
}

export type DiscountGroupsCollection = ReturnType<typeof create>;
export const discountGroupsCollection: CollectionDef<DiscountGroupsCollection> =
  { id: ENTITY.discountGroups, create };
