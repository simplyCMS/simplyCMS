import { BTreeIndex, createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { SectionPropertyAssignment } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import { listSectionPropertyAssignments } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { toSubsetPayload } from '../subset-payload';

/**
 * Довідник на ЧИТАННЯ (Е3-1): схема властивостей розділу — зріз по
 * `sectionId`. CRUD — Е4. БЕЗ `persistenceHandlers`.
 */
function create(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions<SectionPropertyAssignment>({
      id: ENTITY.sectionPropertyAssignments,
      queryClient,
      queryKey: collectionKey(ENTITY.sectionPropertyAssignments),
      syncMode: 'on-demand',
      autoIndex: 'eager',
      defaultIndexType: BTreeIndex,
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listSectionPropertyAssignments({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<
              typeof toSubsetPayload
            >[0],
          ),
        }),
    }),
  );
}

export type SectionPropertyAssignmentsCollection = ReturnType<typeof create>;
export const sectionPropertyAssignmentsCollection: CollectionDef<SectionPropertyAssignmentsCollection> =
  {
    id: ENTITY.sectionPropertyAssignments,
    create,
  };
