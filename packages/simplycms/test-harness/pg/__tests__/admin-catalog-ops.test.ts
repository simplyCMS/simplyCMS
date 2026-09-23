// Е3, Task 4: іменовані операції каталогу проти живої БД (дефолт і порядок
// модифікацій, атомарний набір цін, залишки з гвардом статусу). Шапка —
// ДОСЛІВНО патерн admin-catalog.test.ts (Task 3): createTempDatabase →
// канон → app_runtime → afterAll із closeDbPool() ПЕРШИМ; setResponseStatus
// і requireGrant мокаються з тієї самої причини (поза HTTP-запитом
// Start-контексту немає).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import pg from 'pg';
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

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));

vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  productModificationsOps,
  setDefaultModificationOp,
  reorderModificationOp,
  saveProductPricesOp,
  saveProductPricesInput,
  saveStockOp,
  saveStockInput,
} from 'simplycms/admin-server/impl';

const MIGRATIONS = join(import.meta.dirname, '../../../migrations');

/** Канон у порядку імен — той самий список, що й у baseline.test.ts. */
const canonFiles = (): string[] =>
  readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(MIGRATIONS, name));

const SECTION = '0e300000-0000-4000-8000-000000000011';
const PRODUCT = '0e300000-0000-4000-8000-000000000012';
const POINT = '0e300000-0000-4000-8000-000000000013';
const METHOD = '0e300000-0000-4000-8000-000000000014';

describe('іменовані операції каталогу (Е3, Task 4)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_admin_catalog_ops');
  let dbUrl = '';

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, canonFiles());
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');

    await queryRows(
      dbUrl,
      `insert into public.sections (id, slug, name) values ($1,'ops-s','S')`,
      [SECTION],
    );
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name, section_id) values ($1,'ops-p','P',$2)`,
      [PRODUCT, SECTION],
    );
    // 🔴 pickup_points.method_id — NOT NULL без DEFAULT (schema.ts): точка
    // видачі належить способу доставки, фікстура заводить обидва рядки.
    await queryRows(
      dbUrl,
      `insert into public.shipping_methods (id, code, name) values ($1,'ops-pickup','Самовивіз')`,
      [METHOD],
    );
    await queryRows(
      dbUrl,
      `insert into public.pickup_points (id, method_id, name, city, address, is_active)
       values ($1,$2,'Склад','Київ','вул. Тестова, 1', true)`,
      [POINT, METHOD],
    );
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  const retail = async () =>
    (
      (await queryRows(
        dbUrl,
        `select id from public.price_types where code = 'retail'`,
      )) as {
        id: string;
      }[]
    )[0]!.id;

  // М2 (рев'ю хвилі B): точка для фікстур saveStock — `system`/`active`
  // прапорці явні, бо саме вони визначають «обслуговуючу» точку
  // (`simplycms/inventory`'s `lockTargetStock`).
  const point = async (opts: { isActive: boolean; isSystem: boolean }) => {
    const id = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.pickup_points (id, method_id, name, city, address, is_active, is_system)
       values ($1,$2,'Точка Е3-М2','Київ','вул. М2, 1',$3,$4)`,
      [id, METHOD, opts.isActive, opts.isSystem],
    );
    return id;
  };

  const mod = async (slug: string, sortOrder?: number) => {
    const [m] = await productModificationsOps.insert({
      data: [
        {
          id: crypto.randomUUID(),
          productId: PRODUCT,
          slug,
          name: slug,
          ...(sortOrder !== undefined && { sortOrder }),
        },
      ],
    });
    return m!;
  };

  it('Review Focus 5: setDefault двічі поспіль — рівно один дефолт на товар, без 23505', async () => {
    const a = await mod('a');
    const b = await mod('b');
    await setDefaultModificationOp({ data: { id: a.id } });
    const { rows } = await setDefaultModificationOp({ data: { id: b.id } });
    expect(rows.map((r) => [r.id, r.isDefault])).toEqual(
      expect.arrayContaining([
        [a.id, false],
        [b.id, true],
      ]),
    );
    const defaults = await queryRows(
      dbUrl,
      `select id from public.product_modifications where product_id = $1 and is_default`,
      [PRODUCT],
    );
    expect(defaults).toEqual([{ id: b.id }]);
  });

  it('setDefault не чіпає дефолти ІНШИХ товарів', async () => {
    const other = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name) values ($1,'ops-other','O')`,
      [other],
    );
    const x = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.product_modifications (id, product_id, slug, name, is_default) values ($1,$2,'x','X',true)`,
      [x, other],
    );
    const c = await mod('c');
    await setDefaultModificationOp({ data: { id: c.id } });
    expect(
      await queryRows(
        dbUrl,
        `select is_default from public.product_modifications where id = $1`,
        [x],
      ),
    ).toEqual([{ is_default: true }]);
  });

  it('reorder свапає в межах товару; на краю — no-op', async () => {
    // 🔴 Відхилення від плану (діагностовано прогоном): `mod()` без явного
    // sortOrder дає default 0 — товар до цього кроку вже має a/b/c з тим
    // самим 0 (попередні тести), тож "up"/"down" не знаходять сусіда взагалі
    // (однакові sort_order — задокументовано окремим кейсом нижче). Тут —
    // явні РІЗНІ sortOrder, щоб довести сам свап; нормалізацію дає Task 8.
    const d = await mod('d', 100);
    const { swapped: bottomEdge } = await reorderModificationOp({
      data: { id: d.id, direction: 'down' },
    });
    expect(bottomEdge).toEqual([]); // немає рядка з sort_order > 100 — край
    const neighbor = await mod('d2', 50);
    const up = await reorderModificationOp({
      data: { id: d.id, direction: 'up' },
    });
    expect(up.swapped).toHaveLength(2);
    expect(up.swapped.every((r) => r!.productId === PRODUCT)).toBe(true);
    expect(up.swapped.find((r) => r!.id === d.id)!.sortOrder).toBe(50);
    expect(up.swapped.find((r) => r!.id === neighbor.id)!.sortOrder).toBe(100);
  });

  it('reorder: однаковий sort_order (легасі) — сусіда немає, no-op (нормалізація — Task 8)', async () => {
    await mod('g');
    const h = await mod('h');
    const { swapped } = await reorderModificationOp({
      data: { id: h.id, direction: 'up' },
    });
    expect(swapped).toEqual([]);
  });

  it('saveProductPrices: вставка, оновлення і видалення одним атомарним актом', async () => {
    const pt = await retail();
    const first = await saveProductPricesOp({
      data: {
        productId: PRODUCT,
        modificationId: null,
        prices: [{ priceTypeId: pt, price: '100.50', oldPrice: null }],
      },
    });
    expect(first.rows).toHaveLength(1);
    const second = await saveProductPricesOp({
      data: {
        productId: PRODUCT,
        modificationId: null,
        prices: [{ priceTypeId: pt, price: '90', oldPrice: '100.50' }],
      },
    });
    expect(second.rows[0]!.id).toBe(first.rows[0]!.id); // оновлено, не дубль
    const third = await saveProductPricesOp({
      data: { productId: PRODUCT, modificationId: null, prices: [] },
    });
    expect(third.removedIds).toEqual([first.rows[0]!.id]);
  });

  it('Review Focus 4: відʼємна й нечислова ціна — відмова схеми ДО БД', () => {
    for (const price of ['-1', 'abc', '1.234', ''])
      expect(
        saveProductPricesInput.safeParse({
          productId: PRODUCT,
          modificationId: null,
          prices: [{ priceTypeId: PRODUCT, price, oldPrice: null }],
        }).success,
      ).toBe(false);
    expect(
      saveProductPricesInput.safeParse({
        productId: PRODUCT,
        modificationId: null,
        prices: [{ priceTypeId: PRODUCT, price: '12.50', oldPrice: null }],
      }).success,
    ).toBe(true);
  });

  it('saveStock: кількість 0 → out_of_stock; 3 → знову in_stock; on_order не чіпається', async () => {
    const target = { productId: PRODUCT, modificationId: null };
    const zero = await saveStockOp({
      data: { ...target, quantities: [{ pickupPointId: POINT, quantity: 0 }] },
    });
    expect(zero.target.stockStatus).toBe('out_of_stock');
    const three = await saveStockOp({
      data: { ...target, quantities: [{ pickupPointId: POINT, quantity: 3 }] },
    });
    expect(three.target.stockStatus).toBe('in_stock');
    expect(three.rows).toHaveLength(1); // upsert, не другий рядок
    await queryRows(
      dbUrl,
      `update public.products set stock_status = 'on_order' where id = $1`,
      [PRODUCT],
    );
    const again = await saveStockOp({
      data: { ...target, quantities: [{ pickupPointId: POINT, quantity: 0 }] },
    });
    expect(again.target.stockStatus).toBe('on_order');
  });

  it('saveStock: рівно одна ціль — і товар, і модифікація разом відбиті схемою', () => {
    expect(
      saveStockInput.safeParse({
        productId: PRODUCT,
        modificationId: PRODUCT,
        quantities: [],
      }).success,
    ).toBe(false);
  });

  it("М2 (рев'ю хвилі B): quantities: [] — ZodError, а не мовчазний no-op", () => {
    expect(
      saveStockInput.safeParse({
        productId: PRODUCT,
        modificationId: null,
        quantities: [],
      }).success,
    ).toBe(false);
  });

  // 🔴 М2: дефект, який лагодить це рев'ю — saveStock рахував статус по
  // СУМІ ВСІХ рядків цілі (і по деактивованих точках теж), а вітрина
  // (`lockTargetStock`/`servingQuantity`) — лише по обслуговуючих
  // (`is_system OR is_active`). Системна точка з нулем і деактивована з
  // залишком інакше підняли б статус у `in_stock`, хоча жодна обслуговуюча
  // точка товар не пропонує.
  it('М2, Review Focus: системна точка 0 + деактивована з залишком — статус лишається out_of_stock', async () => {
    const fresh = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name, stock_status) values ($1,'ops-m2-a','M2A','out_of_stock')`,
      [fresh],
    );
    const sys = await point({ isActive: true, isSystem: true });
    const inactive = await point({ isActive: false, isSystem: false });
    // Наявний залишок на ДЕАКТИВОВАНІЙ точці ДО виклику — адмін міг записати
    // його раніше, коли точка ще була активною.
    await queryRows(
      dbUrl,
      `insert into public.stock_by_pickup_point (id, pickup_point_id, product_id, quantity) values ($1,$2,$3,5)`,
      [crypto.randomUUID(), inactive, fresh],
    );
    const { target } = await saveStockOp({
      data: {
        productId: fresh,
        modificationId: null,
        quantities: [
          { pickupPointId: sys, quantity: 0 },
          { pickupPointId: inactive, quantity: 5 },
        ],
      },
    });
    expect(target.stockStatus).toBe('out_of_stock');
  });

  it('М2: ціль лише з рядком на неактивній точці — статус не змінено', async () => {
    const fresh = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name, stock_status) values ($1,'ops-m2-b','M2B','in_stock')`,
      [fresh],
    );
    const inactive = await point({ isActive: false, isSystem: false });
    const { target } = await saveStockOp({
      data: {
        productId: fresh,
        modificationId: null,
        quantities: [{ pickupPointId: inactive, quantity: 5 }],
      },
    });
    expect(target.stockStatus).toBe('in_stock');
  });

  // 🔴 Конкурентність (знахідка аудиту Codex 2026-09-23): дві вкладки / подвійний
  // клік по одній цілі. Без серіалізації друга транзакція падала б 23505 на
  // частковому unique-індексі (дефолт, перший рядок ціни/залишку).
  it('два одночасні setDefault різних модифікацій товару — обидва успішні, дефолт рівно один', async () => {
    const e = await mod('e');
    const f = await mod('f');
    await Promise.all([
      setDefaultModificationOp({ data: { id: e.id } }),
      setDefaultModificationOp({ data: { id: f.id } }),
    ]);
    const defaults = await queryRows(
      dbUrl,
      `select id from public.product_modifications where product_id = $1 and is_default`,
      [PRODUCT],
    );
    expect(defaults).toHaveLength(1);
  });

  it('два одночасні ПЕРШІ saveProductPrices однієї пари — обидва успішні, рядок один', async () => {
    const pt = await retail();
    const fresh = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name) values ($1,'ops-race','R')`,
      [fresh],
    );
    const input = (price: string) => ({
      data: {
        productId: fresh,
        modificationId: null,
        prices: [{ priceTypeId: pt, price, oldPrice: null }],
      },
    });
    await Promise.all([
      saveProductPricesOp(input('10')),
      saveProductPricesOp(input('20')),
    ]);
    expect(
      await queryRows(
        dbUrl,
        `select 1 from public.product_prices where product_id = $1`,
        [fresh],
      ),
    ).toHaveLength(1);
  });

  it('два одночасні ПЕРШІ saveStock однієї цілі — обидва успішні, рядок на точку один', async () => {
    const fresh = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name) values ($1,'ops-race-s','S')`,
      [fresh],
    );
    const input = (quantity: number) => ({
      data: {
        productId: fresh,
        modificationId: null,
        quantities: [{ pickupPointId: POINT, quantity }],
      },
    });
    await Promise.all([saveStockOp(input(1)), saveStockOp(input(2))]);
    expect(
      await queryRows(
        dbUrl,
        `select 1 from public.stock_by_pickup_point where product_id = $1`,
        [fresh],
      ),
    ).toHaveLength(1);
  });

  // Доказ advisory-lock (m3-m6, рев'ю хвилі B): детермінований, без
  // покладання на випадкову перемогу гонки (Promise.all вище доводить лише
  // «обидва успішні», не сам ФАКТ серіалізації). Окремий pg-клієнт (той
  // самий владний dbUrl, що й фікстури) бере ТОЙ САМИЙ advisory-lock, що й
  // операція (`pg_advisory_xact_lock(hashtextextended(key, 0))`,
  // `impl/catalog-lock.ts`), і тримає його у ВІДКРИТІЙ транзакції — виклик
  // операції не сміє резолвитись, доки конкурент не відпустить лок COMMIT-ом.
  describe('advisory-lock: доказ серіалізації (mod-default/prices/stock)', () => {
    /** Тримає pg_advisory_xact_lock(hashtextextended(key,0)) у ВІДКРИТІЙ
     *  транзакції окремого зʼєднання — імітує конкурентну адмін-операцію
     *  ДО того, як вона встигла зняти лок COMMIT-ом.
     *
     * 🔴 `release`/`cleanup` — ІДЕМПОТЕНТНА пара (прапорець `closed`):
     * `release` — штатний шлях (commit + end), `cleanup` — гард у
     * `finally` тесту. Якщо проміжний `expect` між `holdLock` і `release`
     * впаде, `release` НЕ встигне викликатись — без `finally` клієнт
     * лишився б підключеним із ВІДКРИТОЮ транзакцією і лок висів би аж до
     * завершення процесу vitest, б'ючи по НАСТУПНИХ тестах (той самий
     * `key` заблокований). `cleanup` у такому разі відкочує транзакцію
     * (лок знімається і на ROLLBACK, не лише на COMMIT) і закриває
     * зʼєднання; якщо `release` уже відпрацював — `cleanup` no-op. */
    const holdLock = async (key: string) => {
      const client = new pg.Client({ connectionString: dbUrl });
      await client.connect();
      await client.query('begin');
      await client.query(
        'select pg_advisory_xact_lock(hashtextextended($1, 0))',
        [key],
      );
      let closed = false;
      return {
        release: async () => {
          if (closed) return;
          closed = true;
          await client.query('commit');
          await client.end();
        },
        cleanup: async () => {
          if (closed) return;
          closed = true;
          try {
            await client.query('rollback');
          } finally {
            await client.end();
          }
        },
      };
    };

    /** true — проміс НЕ зарезолвився за `ms` (лок тримає). */
    const stillPending = (promise: Promise<unknown>, ms: number) => {
      const TIMEOUT = Symbol('timeout');
      return Promise.race([
        promise.then(() => 'resolved' as const),
        new Promise((r) => setTimeout(r, ms, TIMEOUT)),
      ]).then((v) => v === TIMEOUT);
    };

    it('mod-default: конкурент тримає лок → setDefault чекає ~300мс, резолвиться лише після release', async () => {
      const fresh = crypto.randomUUID();
      await queryRows(
        dbUrl,
        `insert into public.products (id, slug, name) values ($1,'ops-lock-md','LM')`,
        [fresh],
      );
      const m = await queryRows(
        dbUrl,
        `insert into public.product_modifications (id, product_id, slug, name) values ($1,$2,'lm1','LM1') returning id`,
        [crypto.randomUUID(), fresh],
      );
      const lock = await holdLock(`mod-default:${fresh}`);
      try {
        const op = setDefaultModificationOp({
          data: { id: (m[0] as { id: string }).id },
        });
        expect(await stillPending(op, 300)).toBe(true);
        await lock.release();
        await expect(op).resolves.toBeDefined();
      } finally {
        await lock.cleanup();
      }
    });

    it('prices: конкурент тримає лок → saveProductPrices чекає ~300мс, резолвиться лише після release', async () => {
      const pt = await retail();
      const fresh = crypto.randomUUID();
      await queryRows(
        dbUrl,
        `insert into public.products (id, slug, name) values ($1,'ops-lock-pr','LP')`,
        [fresh],
      );
      const lock = await holdLock(`prices:${fresh}:-`);
      try {
        const op = saveProductPricesOp({
          data: {
            productId: fresh,
            modificationId: null,
            prices: [{ priceTypeId: pt, price: '10', oldPrice: null }],
          },
        });
        expect(await stillPending(op, 300)).toBe(true);
        await lock.release();
        await expect(op).resolves.toBeDefined();
      } finally {
        await lock.cleanup();
      }
    });

    it('stock: конкурент тримає лок → saveStock чекає ~300мс, резолвиться лише після release', async () => {
      const fresh = crypto.randomUUID();
      await queryRows(
        dbUrl,
        `insert into public.products (id, slug, name) values ($1,'ops-lock-st','LS')`,
        [fresh],
      );
      const lock = await holdLock(`stock:${fresh}:-`);
      try {
        const op = saveStockOp({
          data: {
            productId: fresh,
            modificationId: null,
            quantities: [{ pickupPointId: POINT, quantity: 1 }],
          },
        });
        expect(await stillPending(op, 300)).toBe(true);
        await lock.release();
        await expect(op).resolves.toBeDefined();
      } finally {
        await lock.cleanup();
      }
    });
  });
});
