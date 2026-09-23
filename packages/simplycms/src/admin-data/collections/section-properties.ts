import { BTreeIndex, createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { SectionProperty } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import { listSectionProperties } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { toSubsetPayload } from '../subset-payload';

/**
 * Довідник на ЧИТАННЯ (Е3-1): характеристики розділу для картки товару.
 * CRUD — Е4. БЕЗ `persistenceHandlers`.
 */
function create(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions<SectionProperty>({
      id: ENTITY.sectionProperties,
      queryClient,
      queryKey: collectionKey(ENTITY.sectionProperties),
      syncMode: 'on-demand',
      autoIndex: 'eager',
      defaultIndexType: BTreeIndex,
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listSectionProperties({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<
              typeof toSubsetPayload
            >[0],
          ),
        }),
    }),
  );
}

export type SectionPropertiesCollection = ReturnType<typeof create>;
export const sectionPropertiesCollection: CollectionDef<SectionPropertiesCollection> =
  {
    id: ENTITY.sectionProperties,
    create,
  };
