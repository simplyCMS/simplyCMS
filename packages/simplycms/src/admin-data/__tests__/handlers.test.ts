import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { persistenceHandlers, type WriteBack } from '../handlers';

/**
 * Три кейси спільних persistence-хендлерів (Task 5, Step 1) — перенесені з
 * `order-statuses-collection.test.ts`, але проти колекції, зібраної
 * `persistenceHandlers` над фейковими insert/update/remove: batch-insert
 * одним викликом сервера; fail-loud на розходженні id ДО write-back.
 */
type Row = { id: string; name: string };

function build(insert: (a: { data: never }) => Promise<Row[]>) {
  // 🔴 ref-комірка розриває цикл self-reference (TS7022) — `collection`
  // не потрібна для типу виклику `persistenceHandlers`, лише її утиліти
  // ПІСЛЯ створення (той самий патерн, що й у кожній колекції каталогу).
  const ref: { current?: WriteBack<Row> } = {};
  const collection = createCollection(
    queryCollectionOptions<Row>({
      id: 'handlers-test',
      queryClient: new QueryClient(),
      queryKey: ['handlers-test', 'list'],
      getKey: (r) => r.id,
      queryFn: async () => [],
      ...persistenceHandlers<Row>(() => ref.current!, {
        entity: 'handlers-test',
        insert,
        update: vi.fn(async () => []),
        remove: vi.fn(async () => ({ count: 0 })),
      }),
    }),
  );
  ref.current = collection;
  return collection;
}

describe('persistenceHandlers', () => {
  it('batch insert — один виклик сервера на всю транзакцію', async () => {
    const insert = vi.fn(async ({ data }: { data: never }) =>
      (data as unknown as Row[]).map((r) => r),
    );
    const c = build(insert);
    await c.preload();
    const tx = c.insert([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    await tx.isPersisted.promise;
    expect(insert).toHaveBeenCalledTimes(1);
    expect(c.get('b')?.name).toBe('B');
  });

  it('сервер повернув інший id — fail-loud, двійник не в кеші', async () => {
    const c = build(async () => [{ id: 'server', name: 'A' }]);
    await c.preload();
    const tx = c.insert({ id: 'client', name: 'A' });
    await expect(tx.isPersisted.promise).rejects.toThrow(/замість "client"/);
    expect(c.get('server')).toBeUndefined();
  });
});
