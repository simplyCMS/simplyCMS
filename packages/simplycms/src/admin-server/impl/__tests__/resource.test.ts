import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';
import { orderStatuses } from 'simplycms/schema';

// Операції торкаються auth/db лише в рантаймі хендлера — мокаємо обидва
// канали, форму схем перевіряємо без БД.
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: 'u1', roles: ['admin'] },
    scope: 'any',
  })),
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
      subject: { userId: 'u2', roles: ['user'] },
      scope: 'own',
    });
    await expect(ops.list({ data: {} })).rejects.toThrow(/own/);
  });

  it('віддає операції-хендлери і схеми, НЕ serverFn', () => {
    for (const k of ['list', 'insert', 'update', 'remove'] as const)
      expect(typeof ops[k]).toBe('function');
    for (const k of [
      'subsetSchema',
      'insertSchema',
      'updateSchema',
      'removeSchema',
      'rowSchema',
    ] as const)
      expect(ops[k]).toBeDefined();
    // serverFn мав би .url/__executeServer — операція plain-функція без них.
    expect('url' in (ops.list as object)).toBe(false);
  });

  it('insertSchema — масив, id обовʼязковий (Е0), readonly зрізаються', () => {
    const noId = ops.insertSchema.safeParse([{ name: 'X', code: 'x' }]);
    expect(noId.success).toBe(false);
    const withExtra = ops.insertSchema.safeParse([
      {
        id: crypto.randomUUID(),
        name: 'X',
        code: 'x',
        isDefault: true,
        createdAt: 'boom',
      },
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

  it('updateSchema: порожній patch — 400 на межі, а не "No values to set" з БД (фінальна хвиля Е1б)', () => {
    // `createUpdateSchema` робить УСІ писані поля optional, тож
    // `{ id, patch: {} }` без .refine() пройшов би схему і впав би
    // синхронно на `db.update().set({})` — 500 замість 400. Той самий
    // клас, що вже сформульовано в 7a4baa9f.
    const parsed = ops.updateSchema.safeParse([
      { id: crypto.randomUUID(), patch: {} },
    ]);
    expect(parsed.success).toBe(false);
  });

  it('exhaustiveness: пропуск І перетин — помилки ТИПУ', () => {
    // Пропущений 'color' → __missingColumns: "color".
    // @ts-expect-error — color не покритий
    defineAdminResource({
      entity: 'order_statuses',
      table: orderStatuses,
      operation: 'catalog.write',
      mode: 'eager',
      filterable: [],
      sortable: [],
      writable: ['name', 'code', 'sortOrder'],
      readonly: ['id', 'isDefault', 'createdAt'],
    });
    // 'createdAt' в ОБОХ списках → __overlappingColumns: "createdAt"
    // (знахідка рев'ю ред.2: перетин давав клієнту право перезаписати
    // мітку створення, а тип мовчав).
    // @ts-expect-error — createdAt і writable, і readonly
    defineAdminResource({
      entity: 'order_statuses',
      table: orderStatuses,
      operation: 'catalog.write',
      mode: 'eager',
      filterable: [],
      sortable: [],
      writable: ['name', 'code', 'color', 'sortOrder', 'createdAt'],
      readonly: ['id', 'isDefault', 'createdAt'],
    });
    expectTypeOf(ops.list).toBeFunction();
  });

  it("тип-регресія (хвіст рев'ю р1): readonly-колонки не зʼявляються у СТАТИЧНІЙ формі insert/update", () => {
    // `.pick(mask as never)` компілювався, але був type-level no-op: аргумент
    // типу `never` не дає TS сайту інференсу для `M` у
    // `pick<M extends Mask<keyof Shape>>`, тож `M` падає до констрейнта
    // `Mask<keyof Shape>` цілком → `Pick<Shape, keyof Shape>` = Shape
    // НЕЗМІНЕНИЙ. Рантайм не постраждав (сам zod ходить по реальному
    // обʼєкту `pickWritable`), але СТАТИЧНО `insertSchema`/`updateSchema`
    // приймали всі сім колонок order_statuses, включно з readonly
    // (isDefault, createdAt) — рівно те, від чого існує exhaustiveness.
    // Ці асерції ловлять регрес КОМПІЛЯТОРОМ: toHaveProperty на присутній
    // ключ — не помилка типу; not.toHaveProperty на ключ, який
    // насправді є в типі, — помилка типу (перевірено вручну на старій формі).
    type InsertItem = z.infer<typeof ops.insertSchema>[number];
    type PatchItem = z.infer<typeof ops.updateSchema>[number]['patch'];

    expectTypeOf<InsertItem>().not.toHaveProperty('isDefault');
    expectTypeOf<InsertItem>().not.toHaveProperty('createdAt');
    expectTypeOf<InsertItem>().toHaveProperty('id');
    expectTypeOf<InsertItem>().toHaveProperty('name');

    expectTypeOf<PatchItem>().not.toHaveProperty('id');
    expectTypeOf<PatchItem>().not.toHaveProperty('isDefault');
    expectTypeOf<PatchItem>().not.toHaveProperty('createdAt');
    expectTypeOf<PatchItem>().toHaveProperty('name');
  });
});
