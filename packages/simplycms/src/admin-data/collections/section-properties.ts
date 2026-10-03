import { createCollection } from '@tanstack/react-db';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { SectionProperty } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertSectionProperties,
  listSectionProperties,
  removeSectionProperties,
  updateSectionProperties,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { onDemandCollectionOptions } from '../on-demand-options';
import { toSubsetPayload } from '../subset-payload';

/**
 * Довідник характеристик: читання — Е3-1 (картка товару), запис — Е4
 * (Task 5) через канон `persistenceHandlers`. On-demand лишається (Е4-9):
 * сторінка списку читає повний зріз без `where` (`orderBy name`), картка —
 * `where id`; обидва узгоджені після запису — доказ
 * `__tests__/on-demand-full-slice.test.tsx`.
 */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<SectionProperty> } = {};
  const collection = createCollection(
    onDemandCollectionOptions<SectionProperty>({
      id: ENTITY.sectionProperties,
      queryClient,
      queryKey: collectionKey(ENTITY.sectionProperties),
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listSectionProperties({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<
              typeof toSubsetPayload
            >[0],
          ),
        }),
      ...persistenceHandlers<SectionProperty>(() => ref.current!, {
        entity: ENTITY.sectionProperties,
        insert: insertSectionProperties,
        update: updateSectionProperties,
        remove: removeSectionProperties,
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type SectionPropertiesCollection = ReturnType<typeof create>;
export const sectionPropertiesCollection: CollectionDef<SectionPropertiesCollection> =
  {
    id: ENTITY.sectionProperties,
    create,
  };
