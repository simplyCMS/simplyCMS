import type { QueryClient } from '@tanstack/react-query';
import { collectionKey } from 'simplycms/contracts/entities';
import type { CollectionDef } from './registry';

/**
 * Перечитати колекцію адмінки, бо ЧУЖА операція змінила її таблицю (каскад
 * FK, повернення резерву на склад, `version` товару), а відповідь операції
 * рядків цієї таблиці не несе.
 *
 * 🔴 Не `utils.refetch()`: той перезапитує лише зрізи з живим спостерігачем
 * (query-db-collection `refetchQueryResults`), а зріз, що лежить у кеші без
 * спостерігача (список товарів під відкритою карткою, закритий діалог
 * залишків), живе до `staleTime` і показав би стан до операції. Інвалідація
 * ключів колекції — нативний механізм TanStack Query: активні зрізи
 * перечитуються одразу, неактивні стають stale і перечитуються при наступному
 * спостерігачі.
 *
 * Власну таблицю колекції оновлює write-back у хендлері (`handlers.ts`), не
 * це: інвалідація щойно записаної колекції лише додала б мережевий запит.
 */
export function invalidateCollection(
  queryClient: QueryClient,
  def: CollectionDef<unknown>,
): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: collectionKey(def.id) });
}
