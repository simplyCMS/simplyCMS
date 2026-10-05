// Е4, Task 3: записувані ресурси довідників каталогу проти живої БД. Шапка —
// патерн admin-catalog.test.ts (createTempDatabase → канон → app_runtime →
// afterAll із closeDbPool() ПЕРШИМ).
//
// 🔴 serverFn тут НЕ викликаються (getRequest() без ALS-контексту падає) —
// requireGrant мокається модульно, а операції беруться напряму зі службового
// server-only субшляху `simplycms/admin-server/impl`. Тест доводить ОПЕРАЦІЮ
// (та сама схема, що в validator serverFn), а не межу HTTP Start.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';
import { holdAdvisoryLock, stillPending } from './fixtures/advisory-lock';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));

vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  sectionsOps,
  priceTypesOps,
  sectionPropertiesOps,
  propertyOptionsOps,
  sectionPropertyAssignmentsOps,
  setDefaultPriceTypeOp,
  removeManyPriceTypesOp,
} from 'simplycms/admin-server/impl';

const MIGRATIONS = join(import.meta.dirname, '../../../migrations');

/** Канон у порядку імен — той самий список, що й у baseline.test.ts. */
const canonFiles = (): string[] =>
  readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(MIGRATIONS, name));

const at = new Date('2026-09-01T00:00:00Z');
let seq = 0;
const next = () => ++seq;

const section = (over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  slug: `e4-section-${next()}`,
  name: 'Розділ Е4',
  ...over,
});

const prop = (over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  slug: `e4-prop-${next()}`,
  name: 'Властивість Е4',
  ...over,
});

const option = (propertyId: string, over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  propertyId,
  slug: `e4-opt-${next()}`,
  name: 'Опція Е4',
  ...over,
});

describe('довідники каталогу: CRUD ресурсів (Е4, Task 3)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_admin_dictionaries');
  let dbUrl = '';

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, canonFiles());
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  const readProp = async (id: string) =>
    (
      (await queryRows(
        dbUrl,
        `select * from public.section_properties where id = $1`,
        [id],
      )) as { property_type: string }[]
    )[0]!;

  it('розділ: insert з клієнтським id, update ставить updatedAt', async () => {
    const s = section();
    const [row] = await sectionsOps.insert({ data: [s] });
    expect(row!.id).toBe(s.id);
    await queryRows(
      dbUrl,
      `update public.sections set updated_at = $1 where id = $2`,
      [at, s.id],
    );
    const [u] = await sectionsOps.update({
      data: [{ id: s.id, patch: { name: 'Нова назва' } }],
    });
    expect(u!.name).toBe('Нова назва');
    expect(u!.updatedAt.getTime()).toBeGreaterThan(at.getTime());
  });

  it('розділ: дубль slug → AdminConflictError unique (constraint містить slug)', async () => {
    await expect(
      sectionsOps.insert({ data: [section({ slug: 'dup' })] }),
    ).resolves.toHaveLength(1);
    const err = await sectionsOps
      .insert({ data: [section({ slug: 'dup' })] })
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ name: 'AdminConflictError', kind: 'unique' });
    expect((err as { constraint?: string }).constraint).toMatch(/slug/);
  });

  it('розділ: кириличний slug відбивається схемою до транзакції', async () => {
    const s = section({ slug: 'розділ' });
    await expect(sectionsOps.insert({ data: [s] })).rejects.toMatchObject({
      name: 'ValidationError',
    });
    expect(
      await queryRows(dbUrl, `select 1 from public.sections where id = $1`, [
        s.id,
      ]),
    ).toHaveLength(0);
  });

  it('розділ з товаром видаляється, товар лишається з section_id NULL', async () => {
    const s = section();
    await sectionsOps.insert({ data: [s] });
    const productId = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name, section_id) values ($1, $2, 'Товар', $3)`,
      [productId, `e4-product-${next()}`, s.id],
    );
    await expect(sectionsOps.remove({ data: [{ id: s.id }] })).resolves.toEqual(
      { count: 1 },
    );
    expect(
      await queryRows(
        dbUrl,
        `select section_id from public.products where id = $1`,
        [productId],
      ),
    ).toEqual([{ section_id: null }]);
  });

  it('розділ: parentId у payload мовчки зрізається (Е4-3)', async () => {
    const parent = section();
    await sectionsOps.insert({ data: [parent] });
    const child = section({ parentId: parent.id });
    const [row] = await sectionsOps.insert({ data: [child as never] });
    expect(row!.parentId).toBeNull();
    expect(
      await queryRows(
        dbUrl,
        `select parent_id from public.sections where id = $1`,
        [child.id],
      ),
    ).toEqual([{ parent_id: null }]);
  });

  it('властивість: propertyType пишеться insert-ом і НЕ змінюється update-ом', async () => {
    const [row] = await sectionPropertiesOps.insert({
      data: [prop({ propertyType: 'select' })],
    });
    await sectionPropertiesOps.update({
      data: [
        { id: row!.id, patch: { name: 'x', propertyType: 'text' } as never },
      ],
    });
    const after = await readProp(row!.id);
    expect(after.property_type).toBe('select');
    expect((after as unknown as { name: string }).name).toBe('x');
  });

  it('властивість: кириличний slug відбивається схемою', async () => {
    await expect(
      sectionPropertiesOps.insert({ data: [prop({ slug: 'колір' })] }),
    ).rejects.toMatchObject({ name: 'ValidationError' });
  });

  it('властивість: видалення каскадно зносить опції і значення в товарах', async () => {
    const p = prop({ propertyType: 'select' });
    await sectionPropertiesOps.insert({ data: [p] });
    const o = option(p.id);
    await propertyOptionsOps.insert({ data: [o] });
    const productId = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name) values ($1, $2, 'Товар')`,
      [productId, `e4-product-${next()}`],
    );
    await queryRows(
      dbUrl,
      `insert into public.product_property_values (id, product_id, property_id, option_id)
       values ($1, $2, $3, $4)`,
      [crypto.randomUUID(), productId, p.id, o.id],
    );
    await sectionPropertiesOps.remove({ data: [{ id: p.id }] });
    expect(
      await queryRows(
        dbUrl,
        `select 1 from public.property_options where property_id = $1`,
        [p.id],
      ),
    ).toHaveLength(0);
    expect(
      await queryRows(
        dbUrl,
        `select 1 from public.product_property_values where property_id = $1`,
        [p.id],
      ),
    ).toHaveLength(0);
    // Товар живий — каскад зносить лише значення, не власника.
    expect(
      await queryRows(dbUrl, `select 1 from public.products where id = $1`, [
        productId,
      ]),
    ).toHaveLength(1);
  });

  it('опція: propertyId незмінний update-ом; дубль (propertyId, slug) → unique', async () => {
    const p1 = prop({ propertyType: 'select' });
    const p2 = prop({ propertyType: 'select' });
    await sectionPropertiesOps.insert({ data: [p1, p2] });
    const o = option(p1.id, { slug: 'red' });
    await propertyOptionsOps.insert({ data: [o] });
    const [u] = await propertyOptionsOps.update({
      data: [
        { id: o.id, patch: { name: 'Червоний', propertyId: p2.id } as never },
      ],
    });
    expect(u!.propertyId).toBe(p1.id);
    expect(u!.name).toBe('Червоний');
    await expect(
      propertyOptionsOps.insert({ data: [option(p1.id, { slug: 'red' })] }),
    ).rejects.toMatchObject({ name: 'AdminConflictError', kind: 'unique' });
    // Той самий slug в ІНШІЙ властивості — легальний.
    await expect(
      propertyOptionsOps.insert({ data: [option(p2.id, { slug: 'red' })] }),
    ).resolves.toHaveLength(1);
  });

  it('опція: кириличний slug відбивається схемою', async () => {
    const p = prop({ propertyType: 'select' });
    await sectionPropertiesOps.insert({ data: [p] });
    await expect(
      propertyOptionsOps.insert({ data: [option(p.id, { slug: 'червоний' })] }),
    ).rejects.toMatchObject({ name: 'ValidationError' });
  });

  describe('призначення', () => {
    let sectionId = '';
    let propertyId = '';
    const assign = (over: Record<string, unknown> = {}) => ({
      id: crypto.randomUUID(),
      sectionId,
      propertyId,
      ...over,
    });

    beforeAll(async () => {
      const s = section();
      const p = prop();
      await sectionsOps.insert({ data: [s] });
      await sectionPropertiesOps.insert({ data: [p] });
      sectionId = s.id;
      propertyId = p.id;
    });

    it('призначення: друге для тієї ж пари розділ/властивість з іншим appliesTo → unique', async () => {
      await sectionPropertyAssignmentsOps.insert({
        data: [assign({ appliesTo: 'product' })],
      });
      await expect(
        sectionPropertyAssignmentsOps.insert({
          data: [assign({ appliesTo: 'modification' })],
        }),
      ).rejects.toMatchObject({ name: 'AdminConflictError', kind: 'unique' });
    });

    it('призначення: appliesTo поза переліком відбивається схемою', async () => {
      const p = prop();
      await sectionPropertiesOps.insert({ data: [p] });
      await expect(
        sectionPropertyAssignmentsOps.insert({
          data: [assign({ propertyId: p.id, appliesTo: 'variant' })],
        }),
      ).rejects.toMatchObject({ name: 'ValidationError' });
      expect(
        await queryRows(
          dbUrl,
          `select 1 from public.section_property_assignments where property_id = $1`,
          [p.id],
        ),
      ).toHaveLength(0);
    });

    it('призначення: sortOrder змінюється update-ом, appliesTo — ні (insertOnly)', async () => {
      const [row] = (await sectionPropertyAssignmentsOps.list({
        data: {
          subset: {
            filters: [
              { field: ['sectionId'], operator: 'eq', value: sectionId },
              { field: ['propertyId'], operator: 'eq', value: propertyId },
            ],
          },
        },
      }))!;
      const [u] = await sectionPropertyAssignmentsOps.update({
        data: [
          {
            id: row!.id,
            patch: { sortOrder: 5, appliesTo: 'modification' } as never,
          },
        ],
      });
      expect(u!.sortOrder).toBe(5);
      expect(u!.appliesTo).toBe('product');
    });
  });

  it('тип ціни: кириличний code відбивається схемою; isDefault у payload зрізається', async () => {
    await expect(
      priceTypesOps.insert({
        data: [{ id: crypto.randomUUID(), name: 'Опт', code: 'оптова' }],
      }),
    ).rejects.toMatchObject({ name: 'ValidationError' });
    const id = crypto.randomUUID();
    const [row] = await priceTypesOps.insert({
      data: [
        { id, name: 'Опт', code: 'wholesale_e4', isDefault: true } as never,
      ],
    });
    expect(row!.isDefault).toBe(false);
    expect(
      await queryRows(
        dbUrl,
        `select count(*)::int n from public.price_types where is_default`,
      ),
    ).toEqual([{ n: 1 }]);
  });

  // ── Task 4 (Е4-1, Е4-2): іменовані операції типу ціни ──────────────────
  describe('типи цін: іменовані операції (Е4-2)', () => {
    /** Дефолт канону — 0003_seed.sql. */
    const RETAIL = '00000003-0000-4000-8000-000000000001';

    /** Новий тип ціни: не дефолтний, без цін. */
    const freshPriceType = async (): Promise<string> => {
      const id = crypto.randomUUID();
      await priceTypesOps.insert({
        data: [{ id, name: `Тип ${next()}`, code: `e4_pt_${next()}` }],
      });
      return id;
    };
    const exists = async (id: string) =>
      (
        await queryRows(
          dbUrl,
          `select 1 from public.price_types where id = $1`,
          [id],
        )
      ).length === 1;
    const defaults = async () =>
      (
        (await queryRows(
          dbUrl,
          `select id from public.price_types where is_default order by id`,
        )) as { id: string }[]
      ).map((r) => r.id);
    const priceCount = async (priceTypeId: string) =>
      (
        (await queryRows(
          dbUrl,
          `select count(*)::int n from public.product_prices where price_type_id = $1`,
          [priceTypeId],
        )) as { n: number }[]
      )[0]!.n;

    // Кожен кейс стартує з канонічного дефолту retail — привілейованим
    // підключенням, двома кроками (частковий unique-індекс перевіряється
    // негайно, тож «поставити й зняти» одним UPDATE міг би дати 23505).
    beforeEach(async () => {
      await queryRows(
        dbUrl,
        `update public.price_types set is_default = false where id <> $1`,
        [RETAIL],
      );
      await queryRows(
        dbUrl,
        `update public.price_types set is_default = true where id = $1`,
        [RETAIL],
      );
    });

    it('setDefault знімає дефолт з retail і ставить новому; повертає обидва рядки', async () => {
      const WHOLESALE = await freshPriceType();
      const { rows } = await setDefaultPriceTypeOp({ data: { id: WHOLESALE } });
      expect(rows.map((r) => [r.id, r.isDefault]).sort()).toEqual(
        [
          [RETAIL, false],
          [WHOLESALE, true],
        ].sort(),
      );
      expect(await defaults()).toEqual([WHOLESALE]);
    });

    it('setDefault на вже дефолтному — no-op без 23505', async () => {
      const { rows } = await setDefaultPriceTypeOp({ data: { id: RETAIL } });
      expect(rows.map((r) => [r.id, r.isDefault])).toEqual([[RETAIL, true]]);
      expect(await defaults()).toEqual([RETAIL]);
    });

    it('два одночасні setDefault різних типів → рівно один дефолт', async () => {
      const A = await freshPriceType();
      const B = await freshPriceType();
      await Promise.all([
        setDefaultPriceTypeOp({ data: { id: A } }),
        setDefaultPriceTypeOp({ data: { id: B } }),
      ]);
      const [{ n }] = (await queryRows(
        dbUrl,
        'select count(*)::int n from public.price_types where is_default',
      )) as [{ n: number }];
      expect(n).toBe(1);
      expect([A, B]).toContain((await defaults())[0]);
    });

    it('remove дефолтного — помилка, нічого не видалено (увесь batch)', async () => {
      const SPARE = await freshPriceType();
      await expect(
        removeManyPriceTypesOp({ data: [{ id: RETAIL }, { id: SPARE }] }),
      ).rejects.toThrow(/дефолт/);
      expect(await exists(SPARE)).toBe(true);
      expect(await exists(RETAIL)).toBe(true);
    });

    it('remove типу з цінами → AdminConflictError reference, ціни цілі (Review Focus 1)', async () => {
      const WHOLESALE_WITH_PRICES = await freshPriceType();
      const productId = crypto.randomUUID();
      await queryRows(
        dbUrl,
        `insert into public.products (id, slug, name) values ($1, $2, 'Товар')`,
        [productId, `e4-product-${next()}`],
      );
      await queryRows(
        dbUrl,
        `insert into public.product_prices (id, price_type_id, product_id, price)
         values ($1, $2, $3, '10.00')`,
        [crypto.randomUUID(), WHOLESALE_WITH_PRICES, productId],
      );
      await expect(
        removeManyPriceTypesOp({ data: [{ id: WHOLESALE_WITH_PRICES }] }),
      ).rejects.toMatchObject({
        name: 'AdminConflictError',
        kind: 'reference',
      });
      expect(await priceCount(WHOLESALE_WITH_PRICES)).toBe(1);
      expect(await exists(WHOLESALE_WITH_PRICES)).toBe(true);
    });

    it('remove типу без посилань — count 1', async () => {
      const id = await freshPriceType();
      await expect(removeManyPriceTypesOp({ data: [{ id }] })).resolves.toEqual(
        { count: 1 },
      );
      expect(await exists(id)).toBe(false);
    });

    it('remove неіснуючого id — помилка, без часткового видалення', async () => {
      const SPARE = await freshPriceType();
      await expect(
        removeManyPriceTypesOp({
          data: [{ id: SPARE }, { id: crypto.randomUUID() }],
        }),
      ).rejects.toThrow();
      expect(await exists(SPARE)).toBe(true);
    });

    // 🔴 ред.2 (аудит Codex, знахідка 2): гонка, яку зразки Е1б/Е3
    // пропускають — remove(X) між читанням X і UPDATE цілі лишав би нуль
    // дефолтів.
    it('setDefault(X) паралельно з remove(X) → завжди рівно один дефолт', async () => {
      for (let i = 0; i < 20; i++) {
        const X = await freshPriceType();
        await Promise.allSettled([
          setDefaultPriceTypeOp({ data: { id: X } }),
          removeManyPriceTypesOp({ data: [{ id: X }] }),
        ]);
        const [{ n }] = (await queryRows(
          dbUrl,
          'select count(*)::int n from public.price_types where is_default',
        )) as [{ n: number }];
        expect(n, `ітерація ${i}`).toBe(1);
      }
    });

    // Е4-12: детермінований доказ advisory-локу `price-type-default` для
    // ОБОХ операцій — стрес-тести вище перемогу гонки лише ймовірно
    // розрізняють (Е4-11: 2 червоні з 55 прогонів без локу в setDefault).
    describe('advisory-lock: доказ серіалізації (price-type-default)', () => {
      const holdLock = (key: string) => holdAdvisoryLock(dbUrl, key);

      it('setDefault: конкурент тримає лок → чекає, дефолт не змінено до release', async () => {
        const X = await freshPriceType();
        const lock = await holdLock('price-type-default');
        try {
          const op = setDefaultPriceTypeOp({ data: { id: X } });
          expect(await stillPending(op, 300)).toBe(true);
          expect(await defaults()).toEqual([RETAIL]);
          await lock.release();
          await expect(op).resolves.toBeDefined();
          expect(await defaults()).toEqual([X]);
        } finally {
          await lock.cleanup();
        }
      });

      it('remove: конкурент тримає лок → чекає, рядок живий до release', async () => {
        const Y = await freshPriceType();
        const lock = await holdLock('price-type-default');
        try {
          const op = removeManyPriceTypesOp({ data: [{ id: Y }] });
          expect(await stillPending(op, 300)).toBe(true);
          expect(await exists(Y)).toBe(true);
          await lock.release();
          await expect(op).resolves.toEqual({ count: 1 });
          expect(await exists(Y)).toBe(false);
        } finally {
          await lock.cleanup();
        }
      });
    });

    it('setDefault неіснуючого id — помилка, старий дефолт лишився', async () => {
      await expect(
        setDefaultPriceTypeOp({ data: { id: crypto.randomUUID() } }),
      ).rejects.toThrow();
      expect(await defaults()).toEqual([RETAIL]);
    });
  });
});
