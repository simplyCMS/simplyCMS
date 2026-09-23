import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { orderStatuses, products } from 'simplycms/schema';

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
import { productsOps } from '../products/resource';
import { productModificationsOps } from '../product-modifications/resource';

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

  // ID — будь-який uuid-літерал.
  const ID = '0e300000-0000-4000-8000-0000000000aa';

  it('touch: update дописує updatedAt = Date (Е3-9)', async () => {
    const set = vi.fn(() => ({
      where: () => ({ returning: async () => [{ id: ID }] }),
    }));
    const { withActor } = await import('simplycms/db');
    vi.mocked(withActor).mockImplementationOnce(async (_a, fn) =>
      fn({ update: () => ({ set }) } as never, {} as never),
    );
    const productOps = defineAdminResource({
      entity: 'products',
      table: products,
      operation: 'catalog.write',
      mode: 'on-demand',
      filterable: [],
      sortable: [],
      touch: 'updatedAt',
      writable: [
        'sectionId',
        'slug',
        'name',
        'shortDescription',
        'description',
        'isActive',
        'isFeatured',
        'metaTitle',
        'metaDescription',
        'images',
        'hasModifications',
        'sku',
        'stockStatus',
        'returnPolicy',
        'shippingDetails',
      ],
      readonly: ['id', 'createdAt', 'updatedAt'],
    });
    await productOps.update({ data: [{ id: ID, patch: { name: 'X' } }] });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'X', updatedAt: expect.any(Date) }),
    );
  });

  // 🔴 Доказ тай-брейкера (Е3-8) — ЮНІТОМ, не харнесом (аудит 2026-09-23):
  // Postgres на малій незмінній таблиці часто повертає той самий порядок і
  // без `id`, тож харнес-тест пагінації (Task 3) лишився б зеленим і без
  // фіксу.
  it('list: id asc — ОСТАННІЙ ключ сортування, і після defaultOrder, і після sorts', async () => {
    // 🔴 Хвіст Task 3 (передіснуюча помилка typecheck, не чіплялась Task 1):
    // мок без оголошених параметрів звужував `.mock.calls[n]` до `[]`
    // (нуль-елементний tuple) — TS2493 на індексації нижче. Rest-параметр
    // повертає тип виклику до `unknown[]`, рантайм не змінюється (той самий
    // `this`-повернення для ланцюжка `.orderBy().limit()…`).
    const orderBy = vi.fn(function (this: unknown, ..._cols: unknown[]) {
      return this;
    });
    const q = {
      where: () => q,
      orderBy,
      limit: () => q,
      offset: () => q,
      then: (r: (v: unknown[]) => unknown) => r([]),
    };
    const { withActor } = await import('simplycms/db');
    vi.mocked(withActor).mockImplementation(async (_a, fn) =>
      fn(
        { select: () => ({ from: () => ({ $dynamic: () => q }) }) } as never,
        {} as never,
      ),
    );
    await ops.list({ data: {} });
    await ops.list({
      data: { subset: { sorts: [{ field: ['name'], direction: 'desc' }] } },
    });
    expect(orderBy).toHaveBeenCalledTimes(2); // один виклик на запит — масив, не ланцюг

    // 🔴 ПОВНИЙ масив, не лише останній ключ: мутація, що відкидає клієнтські
    // `sorts` і завжди йде дефолтом, лишила б `id` останнім і в обох
    // викликах — тест на "останній ключ = id" її не ловить.
    const dialect = new PgDialect();
    const render = (key: unknown) => dialect.sqlToQuery(key as SQL).sql;

    // Виклик 1: порожній subset → defaultOrder (sort_order asc), потім id.
    const call1 = orderBy.mock.calls[0];
    expect(call1).toHaveLength(2);
    expect(render(call1[0])).toContain('"sort_order" asc');
    expect(render(call1[1])).toContain('"id" asc');

    // Виклик 2: sorts = [name desc] → ЛИШЕ клієнтський ключ, потім id.
    const call2 = orderBy.mock.calls[1];
    expect(call2).toHaveLength(2);
    expect(render(call2[0])).toContain('"name" desc');
    expect(render(call2[1])).toContain('"id" asc');
  });
});

// m3 (рев'ю хвилі B): `images` — jsonb БЕЗ власної форми в drizzle-zod
// (`.$type<string[]>()` бачить лише Drizzle, не генератор Zod-схем);
// дефолтна схема рушія — вільний `jsonSchema` (приймає `{}` як валідний
// JSON). `refine` у products/resource.ts і product-modifications/resource.ts
// звужує це до `z.array(z.string())`, зберігаючи nullable/optional (колонка
// без `.notNull()`, з DEFAULT `[]`).
describe('m3: refine ресурсу — images звужено до масиву рядків', () => {
  const P_ID = '0e300000-0000-4000-8000-000000000001';
  const M_ID = '0e300000-0000-4000-8000-000000000002';

  it('products.insert: images: {} — ZodError; [] і [рядок] — валідні; відсутнє/null — валідні (nullable+optional)', () => {
    const row = { id: P_ID, slug: 'p1', name: 'P1' };
    expect(
      productsOps.insertSchema.safeParse([{ ...row, images: {} }]).success,
    ).toBe(false);
    expect(
      productsOps.insertSchema.safeParse([{ ...row, images: [] }]).success,
    ).toBe(true);
    expect(
      productsOps.insertSchema.safeParse([{ ...row, images: ['ref'] }]).success,
    ).toBe(true);
    expect(productsOps.insertSchema.safeParse([row]).success).toBe(true);
    expect(
      productsOps.insertSchema.safeParse([{ ...row, images: null }]).success,
    ).toBe(true);
  });

  it("products.update: patch.images: 'str' — ZodError; масив рядків — валідний", () => {
    expect(
      productsOps.updateSchema.safeParse([
        { id: P_ID, patch: { images: 'str' } },
      ]).success,
    ).toBe(false);
    expect(
      productsOps.updateSchema.safeParse([
        { id: P_ID, patch: { images: ['a', 'b'] } },
      ]).success,
    ).toBe(true);
  });

  it('products.update: patch БЕЗ images — ok (рефайнена колонка лишається optional, а не стає required)', () => {
    // Ловить розходження, яке НЕ зловили б тести вище: `refine` замінює
    // саму zod-схему колонки, а nullable/optional довішує ПОВЕРХ рушій
    // drizzle-zod (`updateConditions.optional` — завжди `true` для update).
    // Якщо цю формулу загубити (наприклад, узяти рефайнер СИРИМ, без
    // подальшого `.optional()`), `images` стала б обовʼязковим полем
    // patch-а — кожен `update`, що не чіпає картинки, впав би.
    expect(
      productsOps.updateSchema.safeParse([{ id: P_ID, patch: { name: 'P2' } }])
        .success,
    ).toBe(true);
  });

  it('product-modifications.insert: images: {} — ZodError; [] і [рядок] — валідні', () => {
    const row = { id: M_ID, productId: P_ID, slug: 'm1', name: 'M1' };
    expect(
      productModificationsOps.insertSchema.safeParse([{ ...row, images: {} }])
        .success,
    ).toBe(false);
    expect(
      productModificationsOps.insertSchema.safeParse([{ ...row, images: [] }])
        .success,
    ).toBe(true);
    expect(
      productModificationsOps.insertSchema.safeParse([
        { ...row, images: ['ref'] },
      ]).success,
    ).toBe(true);
  });

  it("product-modifications.update: patch.images: 'str' — ZodError; масив рядків — валідний", () => {
    expect(
      productModificationsOps.updateSchema.safeParse([
        { id: M_ID, patch: { images: 'str' } },
      ]).success,
    ).toBe(false);
    expect(
      productModificationsOps.updateSchema.safeParse([
        { id: M_ID, patch: { images: ['a'] } },
      ]).success,
    ).toBe(true);
  });
});
