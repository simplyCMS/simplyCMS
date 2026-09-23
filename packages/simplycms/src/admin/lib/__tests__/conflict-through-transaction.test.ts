import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { persistenceHandlers, type WriteBack } from 'simplycms/admin-data';
import { adminErrorKey } from '../admin-error';

/**
 * Відтворює реальний шлях `products.update()` (TanStack DB, `handlers.ts`
 * onUpdate) — не `admin-error.test.ts`'s ручний `Object.assign(new
 * Error(...))`. Е3-20 (закрито): serverFn кидає САМЕ таку форму, яку
 * `domainErrorAdapter` (`runtime/domain-error-adapter.test.ts` доводить це
 * реальним seroval-раунд-тріпом) віддає клієнту — `Error` з `name`/полями
 * НА ВЕРХНЬОМУ рівні (не плоский обʼєкт, не обгорнутий у `.cause`).
 * `@tanstack/db`'s `commit()` (`error instanceof Error ? error : new
 * Error(String(error))`) на такому вході бере гілку `instanceof Error` і
 * ідентичність / поля НЕ чіпає — окремої нормалізації (`normalizeThrown`,
 * знято) не треба.
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
          throw Object.assign(
            new Error('[admin-server] конфлікт unique: products_slug_key'),
            {
              name: 'AdminConflictError',
              kind: 'unique',
              constraint: 'products_slug_key',
            },
          );
        },
        remove: async () => ({ count: 0 }),
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

describe('adminErrorKey через реальну транзакцію TanStack DB', () => {
  it('Error(name/kind/constraint) serverFn → tx.isPersisted.promise reject → adminErrorKey → slugTaken', async () => {
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
    // 🔴 Поля НА ВЕРХНЬОМУ рівні, не під .cause — commit() зберігає
    // ідентичність кинутого обʼєкта, коли він уже instanceof Error.
    expect(caught).toMatchObject({
      name: 'AdminConflictError',
      kind: 'unique',
    });
    expect(adminErrorKey(caught)).toBe('admin.errors.slugTaken');
  });
});
