import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

// 🔴 Деривація від брифу: `const insertMock = vi.fn(...)` НЕ компілюється в
// рантаймі — `vi.mock` хоїститься над звичайним `const`, тож factory нижче
// бачить `insertMock` ДО ініціалізації (ReferenceError: Cannot access
// 'insertMock' before initialization; підтверджено запуском брифового коду
// один-в-один). `vi.hoisted` — офіційний обхід саме цього випадку: він теж
// хоїститься, але ПЕРЕД `vi.mock` у порядку появи в файлі, тож значення вже
// готове, коли factory виконується.
const { insertMock } = vi.hoisted(() => ({
  insertMock: vi.fn(async ({ data }: { data: { id: string }[] }) =>
    data.map((r) => ({
      isDefault: false,
      createdAt: '2026-01-01',
      color: null,
      sortOrder: 0,
      ...r,
    })),
  ),
}));
vi.mock('simplycms/admin-server', () => ({
  listOrderStatuses: vi.fn(async () => []),
  insertOrderStatuses: insertMock,
  updateOrderStatuses: vi.fn(async ({ data }) =>
    data.map((d: { id: string }) => ({ id: d.id })),
  ),
  removeOrderStatuses: vi.fn(async () => ({ count: 1 })),
  setDefaultOrderStatus: vi.fn(),
  reorderOrderStatus: vi.fn(),
}));

import { getCollection } from '../registry';
import { orderStatusesCollection } from '../collections/order-statuses';

describe('колекція order_statuses', () => {
  it('id колекції — з ENTITY (значення "order_statuses" з реєстру, не довільне)', () => {
    expect(orderStatusesCollection.id).toBe('order_statuses');
  });

  it('batch-insert шле ВСІ мутації транзакції одним викликом', async () => {
    const c = getCollection(new QueryClient(), orderStatusesCollection);
    // 🔴 Sync-контекст ОБОВʼЯЗКОВИЙ до мутацій: createCollection у 0.8.6
    // стартує sync лише при явному startSync===true (collection/index.js:115),
    // query-адаптер його не передає, а writeUpsert/writeBatch без контексту
    // кидає SyncNotInitializedError (manual-sync.js:122). Прод-шлях це
    // робить preload-ом у loader (Task 10) — тест дзеркалить його.
    await c.preload();
    const rows = [
      {
        id: crypto.randomUUID(),
        name: 'А',
        code: 'a',
        color: '#111111',
        sortOrder: 1,
      },
      {
        id: crypto.randomUUID(),
        name: 'Б',
        code: 'b',
        color: '#222222',
        sortOrder: 2,
      },
    ];
    const tx = c.insert(rows as never);
    await tx.isPersisted.promise;
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0].data).toHaveLength(2);
  });

  it('live-стан живий: оптимістичний рядок видимий СИНХРОННО, після персисту — серверні значення', async () => {
    // Позитивний контроль (рев'ю ред.2): без нього мок serverFn звів би
    // тест до перевірки хендлерів, а заявляє він інтеграцію з колекцією.
    const c = getCollection(new QueryClient(), orderStatusesCollection);
    await c.preload(); // sync-контекст (див. коментар у batch-тесті)
    const id = crypto.randomUUID();
    const tx = c.insert({
      id,
      name: 'Live',
      code: 'live',
      color: null,
      sortOrder: 5,
    } as never);
    expect(c.has(id), 'оптимістичний рядок не зʼявився в тому ж тіку').toBe(
      true,
    );
    await tx.isPersisted.promise;
    expect(c.has(id), 'після персисту рядок зник').toBe(true);
    expect(c.get(id)?.createdAt, 'write-back не доніс серверних полів').toBe(
      '2026-01-01',
    );
  });

  it('розходження ключів — fail-loud ДО write-back, рядків-двійників немає', async () => {
    insertMock.mockImplementationOnce(async () => [
      {
        id: 'server-generated',
        name: 'X',
        code: 'x',
        color: null,
        sortOrder: 0,
        isDefault: false,
        createdAt: '2026-01-01',
      },
    ]);
    const c = getCollection(new QueryClient(), orderStatusesCollection);
    await c.preload(); // sync-контекст (див. коментар у batch-тесті)
    const optimisticId = crypto.randomUUID();
    const tx = c.insert({
      id: optimisticId,
      name: 'X',
      code: 'x',
      color: null,
      sortOrder: 0,
    } as never);
    await expect(tx.isPersisted.promise).rejects.toThrow(/id/);
    expect(c.has(optimisticId), 'оптимістичний рядок лишився').toBe(false);
    expect(c.has('server-generated'), 'серверний двійник потрапив').toBe(false);
  });
});
