// `bootstrapStore` (М2б, Р23, І40): старт чистої БД з основною мовою магазину.
// Тексти довідників беруться з мовного пакета, а не з `0003_seed.sql`.
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMigrations, bootstrapStore } from 'simplycms/migrate';
import { SYSTEM_SEED_IDS } from 'simplycms/schema';
import { resolveHarness } from '../up.mjs';
import { applyCleanCanon, queryRows } from '../apply.mjs';
import { CANON_DIR, freshDb } from './fixtures/migrate';

const CYRILLIC = /[А-Яа-яІіЇїЄєҐґ]/;

/** Усі таблиці, які пише bootstrap, і кількість рядків у кожній. */
const COUNT_SQL = `select
  (select count(*) from public.languages)::int as languages,
  (select count(*) from public.order_statuses)::int as statuses,
  (select count(*) from public.price_types)::int as price_types,
  (select count(*) from public.user_categories)::int as categories,
  (select count(*) from public.shipping_zones)::int as zones,
  (select count(*) from public.system_settings)::int as settings`;

describe('bootstrapStore', () => {
  let harness: { url: string; teardown: () => Promise<void> };

  beforeAll(async () => {
    harness = await resolveHarness();
  }, 60_000);

  afterAll(async () => {
    await harness?.teardown();
  });

  /** Нова БД з каноном без старту (`languages` порожня) і клієнтом на ній. */
  async function withCleanDb(
    run: (url: string, client: pg.Client) => Promise<void>,
  ) {
    const db = await freshDb(harness.url);
    const client = new pg.Client({ connectionString: db.url });
    try {
      await applyCleanCanon(db.url);
      await client.connect();
      await run(db.url, client);
    } finally {
      await client.end().catch(() => {});
      await db.drop();
    }
  }

  it('чиста БД: мова, шість статусів, довідники й профіль мовою uk; повтор нічого не пише', async () => {
    await withCleanDb(async (url, client) => {
      expect(await bootstrapStore(client, 'uk')).toEqual({ seeded: true });

      const languages = await queryRows(
        url,
        'select id, code, status, is_default from public.languages',
      );
      expect(languages).toEqual([
        {
          id: SYSTEM_SEED_IDS.language,
          code: 'uk',
          status: 'published',
          is_default: true,
        },
      ]);
      const statuses = await queryRows(
        url,
        'select id, code, name, is_default from public.order_statuses order by sort_order',
      );
      expect(statuses.map((s) => [s.id, s.code, s.is_default])).toEqual(
        Object.entries(SYSTEM_SEED_IDS.orderStatuses).map(([code, id]) => [
          id,
          code,
          code === 'new',
        ]),
      );
      expect(statuses[0]!.name).toBe('Новий');
      expect(
        await queryRows(
          url,
          `select c.id from public.user_categories c
             join public.price_types p on p.id = c.price_type_id
            where c.id = $1 and p.id = $2 and c.is_default`,
          [
            SYSTEM_SEED_IDS.customerCategoryRetail,
            SYSTEM_SEED_IDS.priceTypeRetail,
          ],
        ),
      ).toHaveLength(1);
      expect(
        await queryRows(
          url,
          'select id from public.shipping_zones where is_default and id = $1',
          [SYSTEM_SEED_IDS.mainShippingZone],
        ),
      ).toHaveLength(1);
      const profile = await queryRows(
        url,
        "select id, value->>'name' as name from public.system_settings where key = 'store_profile'",
      );
      expect(profile).toEqual([
        { id: SYSTEM_SEED_IDS.storeProfileSetting, name: 'Мій магазин' },
      ]);

      const before = await queryRows(url, COUNT_SQL);
      expect(await bootstrapStore(client, 'uk')).toEqual({ seeded: false });
      expect(await queryRows(url, COUNT_SQL)).toEqual(before);
    });
  }, 120_000);

  it('основна мова en: жоден текст довідників не кирилічний', async () => {
    await withCleanDb(async (url, client) => {
      await bootstrapStore(client, 'en');
      const texts = (await queryRows(
        url,
        `select name from public.order_statuses
         union all select name from public.price_types
         union all select name from public.user_categories
         union all select name from public.shipping_zones
         union all select name from public.languages
         union all select value->>'name' from public.system_settings where key = 'store_profile'`,
      )) as { name: string }[];
      expect(texts.length).toBeGreaterThan(6);
      for (const { name } of texts) expect(name).not.toMatch(CYRILLIC);
    });
  }, 120_000);

  it('мова без пакета: відмова з переліком наявних, languages порожня', async () => {
    await withCleanDb(async (url, client) => {
      await expect(bootstrapStore(client, 'pl')).rejects.toThrow(
        /«pl».*Наявні: uk, en/,
      );
      expect(await queryRows(url, 'select id from public.languages')).toEqual(
        [],
      );
    });
  }, 120_000);

  it('en-GB: рядок мови зберігає код, тексти беруться з пакета en', async () => {
    await withCleanDb(async (url, client) => {
      await bootstrapStore(client, 'en-GB');
      expect(
        await queryRows(url, 'select code, name from public.languages'),
      ).toEqual([{ code: 'en-GB', name: 'English' }]);
      expect(
        await queryRows(
          url,
          "select name from public.order_statuses where code = 'new'",
        ),
      ).toEqual([{ name: 'New' }]);
    });
  }, 120_000);

  it('два паралельні старти на одній БД: рівно одна мова, один із них засіяв', async () => {
    await withCleanDb(async (url, first) => {
      const second = new pg.Client({ connectionString: url });
      await second.connect();
      try {
        const results = await Promise.all([
          bootstrapStore(first, 'uk'),
          bootstrapStore(second, 'uk'),
        ]);
        expect(results.filter((r) => r.seeded)).toHaveLength(1);
        expect(
          await queryRows(
            url,
            'select count(*)::int as n from public.languages',
          ),
        ).toEqual([{ n: 1 }]);
      } finally {
        await second.end();
      }
    });
  }, 120_000);

  it('applyMigrations з primaryLocale: старт один раз, повтор — bootstrapped false; dry-run нічого не пише', async () => {
    const db = await freshDb(harness.url);
    try {
      const dry = await applyMigrations({
        connectionString: db.url,
        dir: CANON_DIR,
        dryRun: true,
        primaryLocale: 'uk',
      });
      expect(dry.bootstrapped).toBe(false);
      expect(
        await queryRows(db.url, "select to_regclass('public.languages') as t"),
      ).toEqual([{ t: null }]);

      const first = await applyMigrations({
        connectionString: db.url,
        dir: CANON_DIR,
        primaryLocale: 'uk',
      });
      expect(first.bootstrapped).toBe(true);
      const again = await applyMigrations({
        connectionString: db.url,
        dir: CANON_DIR,
        primaryLocale: 'uk',
      });
      expect(again.applied).toEqual([]);
      expect(again.bootstrapped).toBe(false);
      expect(
        await queryRows(
          db.url,
          'select count(*)::int as n from public.languages',
        ),
      ).toEqual([{ n: 1 }]);
    } finally {
      await db.drop();
    }
  }, 120_000);
});
