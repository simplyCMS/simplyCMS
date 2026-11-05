import { describe, expect, it } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import {
  createCollection,
  createLiveQueryCollection,
} from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { collectionKey, ENTITY, entityKey } from 'simplycms/contracts/entities';
import { onDemandCollectionOptions } from '../on-demand-options';
import { persistenceHandlers, type WriteBack } from '../handlers';

/**
 * Поведінковий доказ Е3-15′ (замінює видалений `tests/bare-list-key.test.ts`
 * — той статично сканував КОД; цей запускає РАНТАЙМ-механізм бібліотеки,
 * через який літеральний другий сегмент `'list'` поза `admin-data` шкодить).
 *
 * Write-back eager-колекції пише в УСІ ключі, що розширюють
 * `collectionKey(entity)` — вітрина й `admin-data` ділять ОДИН
 * `QueryClient` (`src/router.tsx`), тож вітринний ключ дістав би чужі
 * (адмінські) рядки (qdc 1.5: дописує їх до вітринних).
 * UPSTREAM:TSDB-1 — docs/architecture/upstream-workarounds.md
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
    await tx.when('settled');

    expect(qc.getQueryData(storefrontKey)).toEqual([storefrontRow]);
  });

  it('КОНТРОЛЬ: ключ під префіксом [products,"list",суфікс] ДІЙСНО забруднюється адмінським рядком — доводить механіку бібліотеки', async () => {
    const qc = new QueryClient();
    // Форма, якої гейт забороняє: буквальний другий сегмент 'list' поза
    // admin-data (те, чим `[...products.list(), 'featured']` був ДО фіксу).
    const colliding = [...collectionKey(ENTITY.products), 'featured'];
    qc.setQueryData(colliding, [storefrontRow]);

    const collection = makeCollection(qc, collectionKey(ENTITY.products));
    await collection.preload();
    const tx = collection.insert(adminRow as never);
    await tx.when('settled');

    // qdc 1.3 перезаписував ключ цілком; 1.5 патчить і ДОПИСУЄ прийняті
    // рядки — вітринний ключ однаково отримує чужий (адмінський) рядок.
    expect(qc.getQueryData(colliding)).toContainEqual(adminRow);
  });
});

/**
 * Eager-кейс вище на on-demand нічого не доводив (механіка там інша), тож
 * тут прямий: on-demand колекція з АКТИВНОЮ підпискою (живий запит), write-back
 * через `insert`. Виміряно на query-db-collection 1.5.1 / db 1.0.0-rc.1.2.
 */
describe('Е3-15′: ізоляція ключів на on-demand колекції', () => {
  async function writeBackOnDemand(qc: QueryClient) {
    const ref: { current?: WriteBack<FakeRow> } = {};
    const collection = createCollection(
      onDemandCollectionOptions<FakeRow>({
        id: 'fake-products-od',
        queryClient: qc,
        queryKey: collectionKey(ENTITY.products),
        getKey: (row) => row.id,
        queryFn: async () => [],
        ...persistenceHandlers<FakeRow>(() => ref.current!, {
          entity: 'fake-products-od',
          insert: async ({ data }) => data as never as FakeRow[],
        }),
      }),
    );
    ref.current = collection;
    const live = createLiveQueryCollection((q) => q.from({ p: collection }));
    await live.preload();
    await collection.insert(adminRow as never).when('settled');
  }

  // Sanity-перевірка, а не доказ ізоляції: variant-ключ узагалі не під
  // префіксом [entity,'list'], тож write-back його не торкається за побудовою.
  it('variant-ключ вітрини лишається ЦІЛИМ після write-back', async () => {
    const qc = new QueryClient();
    const storefrontKey = entityKey(ENTITY.products).variant('featured');
    qc.setQueryData(storefrontKey, [storefrontRow]);
    await writeBackOnDemand(qc);
    expect(qc.getQueryData(storefrontKey)).toEqual([storefrontRow]);
  });

  it('КОНТРОЛЬ: ключ під префіксом [products,"list",суфікс] ВИДАЛЯЄТЬСЯ (не перезаписується, як на 1.2.11)', async () => {
    const qc = new QueryClient();
    const colliding = [...collectionKey(ENTITY.products), 'featured'];
    qc.setQueryData(colliding, [storefrontRow]);
    await writeBackOnDemand(qc);
    expect(qc.getQueryData(colliding)).toBeUndefined();
  });

  it('КОНТРОЛЬ I1: ключ під префіксом із ЧУЖИМ спостерігачем не видаляється і не перезапитується', async () => {
    const qc = new QueryClient();
    const colliding = [...collectionKey(ENTITY.products), 'featured'];
    qc.setQueryData(colliding, [storefrontRow]);
    let fetched = 0;
    const observer = new QueryObserver(qc, {
      queryKey: colliding,
      queryFn: async () => {
        fetched++;
        return [storefrontRow];
      },
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});
    await writeBackOnDemand(qc);
    // Перевірка ВІДСУТНОСТІ події: відкладений перезапит вклався б у паузу.
    await new Promise((r) => setTimeout(r, 30));
    // qdc 1.3 перезапитував такий ключ (M1); 1.5 його не чіпає — чужий
    // ключ лишається цілим без мережі.
    expect(fetched).toBe(0);
    expect(qc.getQueryData(colliding)).toEqual([storefrontRow]);
    unsubscribe();
  });
});
