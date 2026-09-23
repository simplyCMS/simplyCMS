import { BTreeIndex, createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import type { SectionPropertyAssignment } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import { listSectionPropertyAssignments } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { toSubsetPayload } from '../subset-payload';

const key = entityKey(ENTITY.sectionPropertyAssignments);

/**
 * Довідник на ЧИТАННЯ (Е3-1): схема властивостей розділу — зріз по
 * `sectionId`. CRUD — Е4. БЕЗ `persistenceHandlers`.
 */
function create(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions<SectionPropertyAssignment>({
      id: ENTITY.sectionPropertyAssignments,
      queryClient,
      queryKey: key.list(),
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
