// Рантайм-гейт повноти `deps` (Е1б, Task 1): чи справді агрегат читає ЛИШЕ
// таблиці, названі у своєму `AGGREGATE[name].deps`. Е1а лише довела, що
// deps ІСНУЮТЬ (парність зі схемою) — не те, що вони ПОВНІ. Тут — перехоплення
// живого SQL, а не читання декларації.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import pg from 'pg';
import { AGGREGATE, ENTITY } from 'simplycms/contracts/entities';
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

const MIGRATIONS = join(import.meta.dirname, '../../../migrations');
const canonFiles = () =>
  readdirSync(MIGRATIONS)
    .filter((n) => n.endsWith('.sql'))
    .sort()
    .map((n) => join(MIGRATIONS, n));
const DEMO_SEED = join(MIGRATIONS, 'demo/demo-seed.sql');

/**
 * Імена таблиць, які реально згадав SQL. Межі (перевірено на формах
 * Drizzle): ловить from/join з лапками й без, у підзапитах і після CTE;
 * НЕ ловить insert (агрегати описують ЧИТАННЯ) і кома-розділені from a,b
 * (Drizzle такого не генерує).
 */
function tablesInSql(sql: string): string[] {
  const re = /\b(?:from|join)\s+(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?/gi;
  return [...sql.matchAll(re)].map((m) => m[1].toLowerCase());
}

/** UUID демо-сіду (migrations/demo/demo-seed.sql — статичні за Е0). */
const MOD_ID = '10000003-0000-4000-8000-000000000001'; // модифікація «odnofazny»
const PRODUCT_NO_MODS = '10000002-0000-4000-8000-000000000001'; // панель 450w-mono
const PRODUCT_WITH_MODS = '10000002-0000-4000-8000-000000000004'; // інвертор 5kw
const RETAIL_PRICE_TYPE_ID = '00000003-0000-4000-8000-000000000001'; // 0003_seed.sql

/** Власні фікстури поверх сідів (raw SQL, патерн fixtures/showcase.ts). */
const FIXTURES = [
  // Користувач із профілем — для гілок user-контексту (демо-сід без людей).
  `insert into public.users (name, email, email_verified)
   values ('Гейт deps', 'deps-gate@example.test', true)`,
  `insert into public.profiles (id, user_id, email, first_name, category_id)
   select gen_random_uuid(), u.id, u.email, 'Гейт', c.id
     from public.users u cross join public.user_categories c
    where u.email = 'deps-gate@example.test' and c.code = 'retail'`,
  // Активна знижка — без неї loadDiscountGroups виходить після першого
  // запиту і 3 таблиці лишаються темними (discounts.ts:41).
  `insert into public.discount_groups (id, name, operator, is_active)
   values (gen_random_uuid(), 'Гейт deps: група', 'and', true)`,
  // 🔴 `RETAIL_PRICE_TYPE_ID` — КОНКАТЕНАЦІЄЮ, не template-інтерполяцією:
  // однаково валідне JS у backtick-рядку, але конкатенація унеможливлює
  // мовчазний регрес, якщо цей запис колись переїде в звичайні лапки.
  `insert into public.discounts (id, name, group_id, discount_type, discount_value, is_active, price_type_id)
   select gen_random_uuid(), 'Гейт deps: акція', g.id, 'percent', 10, true, '` +
    RETAIL_PRICE_TYPE_ID +
    `'::uuid
     from public.discount_groups g where g.name = 'Гейт deps: група'`,
  `insert into public.discount_conditions (id, discount_id, condition_type)
   select gen_random_uuid(), d.id, 'user_category' from public.discounts d where d.name = 'Гейт deps: акція'`,
  `insert into public.discount_targets (id, discount_id)
   select gen_random_uuid(), d.id from public.discounts d where d.name = 'Гейт deps: акція'`,
  // Сторінка опції: демо-сід не має has_page=true; наявна фікстура
  // tip-paneli НЕ годиться (товари mono без модифікацій — гілка 2b темна).
  `update public.section_properties set has_page = true where slug = 'tip-invertora'`,
];

describe('Е1б: deps агрегатів повні відносно фактичного SQL', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_aggregate_deps');
  let dbUrl = '';
  let userId = '';
  const seen = new Set<string>();
  let restore: (() => void) | null = null;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, [...canonFiles(), DEMO_SEED]);
    for (const sql of FIXTURES) await queryRows(dbUrl, sql);
    const [u] = await queryRows(
      dbUrl,
      `select id from public.users where email = 'deps-gate@example.test'`,
    );
    userId = (u as { id: string }).id;
    // Як у всіх сусідніх тестах: app_runtime, і ЛИШЕ після сетапу.
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');

    const original = pg.Client.prototype.query;
    const spy = vi
      .spyOn(pg.Client.prototype, 'query')
      .mockImplementation(function (this: pg.Client, ...args: unknown[]) {
        const first = args[0] as string | { text?: string };
        const sql = typeof first === 'string' ? first : first?.text;
        if (sql) for (const t of tablesInSql(sql)) seen.add(t);
        return (original as (...a: unknown[]) => unknown).apply(this, args);
      });
    restore = () => spy.mockRestore();
  }, 180_000);

  afterAll(async () => {
    restore?.();
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  /**
   * 🔴 Реєстр РУЧНИЙ і це навмисно: автор агрегату свідомо каже, ЯК він
   * виконується — включно з гілками. Сценарії підібрані так, щоб union
   * SQL покрив усі deps (обґрунтування по гілках — research-док §5).
   */
  const INVOCATIONS: Record<keyof typeof AGGREGATE, () => Promise<void>> = {
    shippingDirectory: async () => {
      const m = await import('simplycms/storefront/loaders');
      await m.withStorefrontDb((db) => m.loadShippingDirectory(db));
    },
    stockInfo: async () => {
      const m = await import('simplycms/storefront/loaders');
      await m.withStorefrontDb(async (db) => {
        await m.loadStockInfo(db, { modificationId: MOD_ID }); // гілка modification
        await m.loadStockInfo(db, { productId: PRODUCT_NO_MODS }); // гілка product
      });
    },
    priceTypeContext: async () => {
      const m = await import('simplycms/storefront/loaders');
      await m.withStorefrontDb((db) => m.loadDefaultPriceTypeId(db));
      await m.withCustomerDb(userId, (db) => m.loadUserPriceTypeId(db, userId));
    },
    discountEnvironment: async () => {
      const m = await import('simplycms/storefront/loaders');
      await m.withStorefrontDb(async (db) => {
        await m.loadDefaultPriceTypeId(db);
        await m.loadDefaultUserCategoryId(db);
        await m.loadDiscountGroups(db, RETAIL_PRICE_TYPE_ID);
      });
      await m.withCustomerDb(userId, async (db) => {
        await m.loadUserPriceTypeId(db, userId);
        await m.loadUserCategoryId(db, userId);
      });
    },
    modificationData: async () => {
      const m = await import('simplycms/storefront/loaders');
      await m.withStorefrontDb(async (db) => {
        await m.loadProductModificationValues(db, PRODUCT_WITH_MODS);
        const ids = await m.loadModificationIds(db, PRODUCT_WITH_MODS);
        await m.loadModificationStock(db, ids);
      });
    },
    propertyOptionPage: async () => {
      const m = await import('simplycms/storefront/loaders');
      await m.withStorefrontDb((db) =>
        m.loadPropertyOption(db, 'tip-invertora', 'on-grid'),
      );
    },
    catalogProducts: async () => {
      const m = await import('simplycms/storefront/loaders');
      await m.withStorefrontDb((db) => m.loadCatalogProducts(db));
    },
  };

  it('кожен агрегат має запис у реєстрі викликів', () => {
    expect(Object.keys(INVOCATIONS).sort()).toEqual(
      Object.keys(AGGREGATE).sort(),
    );
  });

  it.each(Object.keys(AGGREGATE) as (keyof typeof AGGREGATE)[])(
    '%s: deps покривають усі прочитані таблиці',
    async (name) => {
      seen.clear();
      await INVOCATIONS[name]();
      // 🔴 Fail-open захист У КОЖНОМУ кейсі: лоадер, що вийшов раніше без
      // жодного SQL, не сміє давати зелень (сліпота цього класу вже була).
      expect(
        seen.size,
        `${name}: сценарій не виконав жодного запиту`,
      ).toBeGreaterThan(0);

      const declared = new Set<string>(AGGREGATE[name].deps);
      const known = new Set<string>(Object.values(ENTITY));
      const missing = [...seen]
        .filter((t) => known.has(t) && !declared.has(t))
        .sort();
      expect(
        missing,
        `${name}: SQL читає таблиці поза deps — інвалідація буде неповною: ${missing.join(', ')}`,
      ).toEqual([]);
    },
  );
});
