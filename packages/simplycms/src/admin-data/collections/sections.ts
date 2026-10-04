import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { Section } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertSections,
  listSections,
  removeSections,
  updateSections,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers, type WriteBack } from '../handlers';

/**
 * Довідник розділів: читання — Е3-1 (картка товару), запис — Е4 (Task 5)
 * через канон `persistenceHandlers` (write-back, К3-7). Eager — обмежений
 * розмір (Е4-9). 🔴 Одна колекція на ENTITY: хендлери дописані в цей
 * самий файл, другої колекції `sections` немає (Е3-15′).
 */
function create(queryClient: QueryClient) {
  // 🔴 ref-комірка розриває self-reference TS7022 — див. handlers.ts.
  const ref: { current?: WriteBack<Section> } = {};
  const collection = createCollection(
    queryCollectionOptions<Section>({
      id: ENTITY.sections,
      queryClient,
      queryKey: collectionKey(ENTITY.sections),
      getKey: (row) => row.id,
      queryFn: async () => listSections({ data: {} }),
      ...persistenceHandlers<Section>(() => ref.current!, {
        entity: ENTITY.sections,
        insert: insertSections,
        update: updateSections,
        remove: removeSections,
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

export type SectionsCollection = ReturnType<typeof create>;
export const sectionsCollection: CollectionDef<SectionsCollection> = {
  id: ENTITY.sections,
  create,
};
