import { createCollection } from '@tanstack/react-db';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { SectionPropertyAssignment } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertSectionPropertyAssignments,
  listSectionPropertyAssignments,
  removeSectionPropertyAssignments,
  updateSectionPropertyAssignments,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { onDemandCollectionOptions } from '../on-demand-options';
import { toSubsetPayload } from '../subset-payload';

/**
 * Схема властивостей розділу — зріз по `sectionId` (Е3-1). Запис — Е4
 * (Task 5) через канон `persistenceHandlers`; on-demand лишається (Е4-9).
 */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<SectionPropertyAssignment> } = {};
  const collection = createCollection(
    onDemandCollectionOptions<SectionPropertyAssignment>({
      id: ENTITY.sectionPropertyAssignments,
      queryClient,
      queryKey: collectionKey(ENTITY.sectionPropertyAssignments),
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listSectionPropertyAssignments({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<
              typeof toSubsetPayload
            >[0],
          ),
        }),
      ...persistenceHandlers<SectionPropertyAssignment>(() => ref.current!, {
        entity: ENTITY.sectionPropertyAssignments,
        insert: insertSectionPropertyAssignments,
        update: updateSectionPropertyAssignments,
        remove: removeSectionPropertyAssignments,
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type SectionPropertyAssignmentsCollection = ReturnType<typeof create>;
export const sectionPropertyAssignmentsCollection: CollectionDef<SectionPropertyAssignmentsCollection> =
  {
    id: ENTITY.sectionPropertyAssignments,
    create,
  };
