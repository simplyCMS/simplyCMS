import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { Section } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import { listSections } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';

/**
 * Довідник на ЧИТАННЯ (Е3-1): картка товару потребує розділ, CRUD розділів
 * — Е4. Eager — обмежений розмір; БЕЗ `persistenceHandlers` —
 * `collection.insert()` кидає за побудовою, випадковий запис повз Е4
 * неможливий. 🔴 Спільний префікс з Е4 (`sections`/`price_types`): коли
 * хвиля Е4 додасть запис, вона ДОПИШЕ хендлери в цей самий файл, а не
 * заведе другу колекцію того самого ENTITY.
 */
function create(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions<Section>({
      id: ENTITY.sections,
      queryClient,
      queryKey: collectionKey(ENTITY.sections),
      getKey: (row) => row.id,
      queryFn: async () => listSections({ data: {} }),
    }),
  );
}

export type SectionsCollection = ReturnType<typeof create>;
export const sectionsCollection: CollectionDef<SectionsCollection> = {
  id: ENTITY.sections,
  create,
};
