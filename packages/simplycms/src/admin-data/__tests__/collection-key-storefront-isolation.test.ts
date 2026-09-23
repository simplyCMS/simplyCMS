import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { collectionKey, ENTITY, entityKey } from 'simplycms/contracts/entities';
import { persistenceHandlers, type WriteBack } from '../handlers';

/**
 * Поведінковий доказ Е3-15′ (замінює видалений `tests/bare-list-key.test.ts`
 * — той статично сканував КОД; цей запускає РАНТАЙМ-механізм бібліотеки,
 * через який літеральний другий сегмент `'list'` поза `admin-data` шкодить).
 *
 * `@tanstack/query-db-collection` 1.2.11 (`manual-sync.js` →
 * `performWriteOperations`) після кожного write-back кличе
 * `ctx.updateCacheData(усі синхронізовані рядки)`, а та (`query.js:1099`)
 * робить `queryClient.getQueryCache().findAll({ queryKey: baseKey })` —
 * ПРЕФІКСНИЙ пошук (TanStack Query за замовчуванням НЕ `exact`) — і
 * `setQueryData` цим ПОВНИМ набором У КОЖЕН знайдений ключ. Вітрина й
 * `admin-data` ділять ОДИН `QueryClient` (`src/router.tsx`): вітринний
 * ключ, що фізично розширює `collectionKey(entity)` як префікс, дістає
 * чужі (адмінські) рядки.
 */

interface FakeRow {
  id: string;
  name: string;
}

/** Той самий каркас, що в `admin-data/collections/*`, з фейковим serverFn —
 *  без БД і без реального `products.ts` (on-demand-режим ускладнив би сетап,
 *  не змінивши доведений механізм: він однаковий для eager і on-demand). */
function makeCollection(queryClient: QueryClient, queryKey: readonly string[]) {
  const ref: { current?: WriteBack<FakeRow> } = {};
  const collection = createCollection(
    queryCollectionOptions<FakeRow>({
      id: 'fake-products',
      queryClient,
      queryKey,
      getKey: (row) => row.id,
      queryFn: async () => [],
      ...persistenceHandlers<FakeRow>(() => ref.current!, {
        entity: 'fake-products',
        insert: async ({ data }) => data as never as FakeRow[],
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

const storefrontRow: FakeRow = { id: 'sf-1', name: 'вітринний рядок' };
const adminRow = { id: 'admin-1', name: 'адмінський рядок' };

describe('Е3-15′: ізоляція вітрини від write-back колекції', () => {
  it('variant-ключ вітрини НЕ пише під write-back по collectionKey (фікс)', async () => {
    const qc = new QueryClient();
    const storefrontKey = entityKey(ENTITY.products).variant('featured');
    qc.setQueryData(storefrontKey, [storefrontRow]);

    const collection = makeCollection(qc, collectionKey(ENTITY.products));
    await collection.preload();
    const tx = collection.insert(adminRow as never);
    await tx.isPersisted.promise;

    expect(qc.getQueryData(storefrontKey)).toEqual([storefrontRow]);
  });

  it('КОНТРОЛЬ: ключ під префіксом [products,"list",суфікс] ДІЙСНО перезаписується — доводить механіку бібліотеки', async () => {
    const qc = new QueryClient();
    // Форма, якої гейт забороняє: буквальний другий сегмент 'list' поза
    // admin-data (те, чим `[...products.list(), 'featured']` був ДО фіксу).
    const colliding = [...collectionKey(ENTITY.products), 'featured'];
    qc.setQueryData(colliding, [storefrontRow]);

    const collection = makeCollection(qc, collectionKey(ENTITY.products));
    await collection.preload();
    const tx = collection.insert(adminRow as never);
    await tx.isPersisted.promise;

    expect(qc.getQueryData(colliding)).not.toEqual([storefrontRow]);
    expect(qc.getQueryData(colliding)).toEqual([adminRow]);
  });
});
