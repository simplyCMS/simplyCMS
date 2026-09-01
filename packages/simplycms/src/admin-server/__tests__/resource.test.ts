import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { orderStatuses } from 'simplycms/schema';

// Операції торкаються auth/db лише в рантаймі хендлера — мокаємо обидва
// канали, форму схем перевіряємо без БД.
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({ subject: { userId: 'u1', roles: ['admin'] }, scope: 'any' })),
}));
vi.mock('simplycms/db', () => ({
  withActor: vi.fn(async (_actor, fn) => fn({} as never, {} as never)),
}));

import { defineAdminResource } from '../resource';

const ops = defineAdminResource({
  entity: 'order_statuses',
  table: orderStatuses,
  operation: 'catalog.write',
  mode: 'eager',
  filterable: ['code', 'isDefault'],
  sortable: ['sortOrder', 'name'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  writable: ['name', 'code', 'color', 'sortOrder'],
  readonly: ['id', 'isDefault', 'createdAt'],
});

describe('defineAdminResource (К3-4′)', () => {
  it("scope 'own' — фабрична операція кидає, а не мовчки віддає все", async () => {
    // Рев'ю р2: втрата scope нейтралізувала б resolveRequestGrant для
    // Е3–Е6. Фабрика мусить бути admin-only fail-loud.
    const { requireGrant } = await import('simplycms/auth');
    (requireGrant as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      subject: { userId: 'u2', roles: ['user'] }, scope: 'own',
    });
    await expect(ops.list({ data: {} })).rejects.toThrow(/own/);
  });

  it('віддає операції-хендлери і схеми, НЕ serverFn', () => {
    for (const k of ['list', 'insert', 'update', 'remove'] as const)
      expect(typeof ops[k]).toBe('function');
    for (const k of ['subsetSchema', 'insertSchema', 'updateSchema', 'removeSchema', 'rowSchema'] as const)
      expect(ops[k]).toBeDefined();
    // serverFn мав би .url/__executeServer — операція plain-функція без них.
    expect('url' in (ops.list as object)).toBe(false);
  });

  it('insertSchema — масив, id обовʼязковий (Е0), readonly зрізаються', () => {
    const noId = ops.insertSchema.safeParse([{ name: 'X', code: 'x' }]);
    expect(noId.success).toBe(false);
    const withExtra = ops.insertSchema.safeParse([
      { id: crypto.randomUUID(), name: 'X', code: 'x', isDefault: true, createdAt: 'boom' },
    ]);
    // strip: readonly-ключі не доїжджають у БД навіть якщо прислані.
    expect(withExtra.success).toBe(true);
    if (withExtra.success) {
      expect('isDefault' in withExtra.data[0]).toBe(false);
      expect('createdAt' in withExtra.data[0]).toBe(false);
    }
  });

  it('updateSchema: patch не приймає id і readonly', () => {
    const parsed = ops.updateSchema.safeParse([
      { id: crypto.randomUUID(), patch: { name: 'Y', isDefault: true } },
    ]);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect('isDefault' in parsed.data[0].patch).toBe(false);
  });

  it('exhaustiveness: пропуск І перетин — помилки ТИПУ', () => {
    // Пропущений 'color' → __missingColumns: "color".
    // @ts-expect-error — color не покритий
    defineAdminResource({
      entity: 'order_statuses', table: orderStatuses, operation: 'catalog.write',
      mode: 'eager', filterable: [], sortable: [],
      writable: ['name', 'code', 'sortOrder'],
      readonly: ['id', 'isDefault', 'createdAt'],
    });
    // 'createdAt' в ОБОХ списках → __overlappingColumns: "createdAt"
    // (знахідка рев'ю ред.2: перетин давав клієнту право перезаписати
    // мітку створення, а тип мовчав).
    // @ts-expect-error — createdAt і writable, і readonly
    defineAdminResource({
      entity: 'order_statuses', table: orderStatuses, operation: 'catalog.write',
      mode: 'eager', filterable: [], sortable: [],
      writable: ['name', 'code', 'color', 'sortOrder', 'createdAt'],
      readonly: ['id', 'isDefault', 'createdAt'],
    });
    expectTypeOf(ops.list).toBeFunction();
  });
});
