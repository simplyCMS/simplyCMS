import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { persistenceHandlers, type WriteBack } from 'simplycms/admin-data';
import { adminErrorKey } from '../admin-error';

/**
 * Відтворює реальний шлях `products.update()` (TanStack DB, `handlers.ts`
 * onUpdate) — не `admin-error.test.ts`'s ручний `Object.assign(new
 * Error(...))`. Доведено прогоном (UPSTREAM:TSDB-5): без `normalizeThrown`
 * `@tanstack/db`'s `commit()` замінює ПЛОСКИЙ (не-Error) кинутий обʼєкт на
 * `new Error(String(x))` — властивості (`kind`/`constraint`) губляться
 * повністю, `.cause` теж не виставляється. Тут serverFn кидає САМЕ такий
 * плоский обʼєкт, як приходив би з seroval-межі serverFn.
 */
type Row = { id: string; name: string };

function buildWithFailingUpdate() {
  const ref: { current?: WriteBack<Row> } = {};
  const collection = createCollection(
    queryCollectionOptions<Row>({
      id: 'conflict-test',
      queryClient: new QueryClient(),
      queryKey: ['conflict-test', 'list'],
      getKey: (r) => r.id,
      queryFn: async () => [{ id: 'p1', name: 'A' }],
      ...persistenceHandlers<Row>(() => ref.current!, {
        entity: 'conflict-test',
        insert: async () => [],
        update: async () => {
          throw {
            name: 'AdminConflictError',
            message: '[admin-server] конфлікт unique: products_slug_key',
            kind: 'unique',
            constraint: 'products_slug_key',
          };
        },
        remove: async () => ({ count: 0 }),
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

describe('adminErrorKey через реальну транзакцію TanStack DB', () => {
  it('плоский конфлікт serverFn → tx.isPersisted.promise reject → adminErrorKey → slugTaken', async () => {
    const collection = buildWithFailingUpdate();
    await collection.preload();

    const tx = collection.update('p1', (d) => {
      d.name = 'B';
    });

    let caught: unknown;
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(adminErrorKey(caught)).toBe('admin.errors.slugTaken');
  });
});
