// Гейт вибірок, які раніше робив БРАУЗЕР (контур «клієнт не ходить у базу»).
//
// 🔴 Перевіряються саме ті лоадери, на яких тепер стоять serverFn-и вітрини:
// сам `createServerFn` тут не викликається — поза HTTP-контекстом у нього
// немає запиту, — але весь SQL, предикати видимості й нормалізація живуть у
// лоадерах, і довести їх можна лише на живій БД.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import {
  loadCatalogProducts,
  loadFilterOptions,
  loadModificationIds,
  loadModificationStock,
  loadProductModificationValues,
  loadPropertyOption,
  loadSectionBySlug,
  loadSectionFilters,
  loadSectionNumericProperties,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';
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
import {
  FIXTURE_STATEMENTS,
  HIDDEN_PRODUCT_SLUG,
  PAGED_OPTION_SLUG,
  PAGED_PROPERTY_SLUG,
} from './fixtures/storefront';
import {
  CLIENT_FIXTURE_STATEMENTS,
  FILTERED_SECTION_SLUG,
  IN_STOCK_MOD_SLUG,
  MODIFIED_PRODUCT_SLUG,
  OUT_OF_STOCK_MOD_SLUG,
  STOCK_QUANTITY,
} from './fixtures/storefront-client';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../migrations');

/** Помічники харнеса — `.mjs`, тож форму рядка описуємо на місці. */
interface IdRow {
  id: string;
}

const filesToApply = (): string[] => [
  ...readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(MIGRATIONS_DIR, name)),
  join(MIGRATIONS_DIR, 'demo/demo-seed.sql'),
];

describe('вибірки вітрини, знятi з браузера', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_client_queries');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, filesToApply());
    for (const statement of [
      ...FIXTURE_STATEMENTS,
      ...CLIENT_FIXTURE_STATEMENTS,
    ]) {
      await queryRows(dbUrl, statement);
    }
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('каталог із фільтром розділу: лише товари цього розділу', async () => {
    const { all, scoped } = await withStorefrontDb(async (db) => {
      const section = await loadSectionBySlug(db, FILTERED_SECTION_SLUG);
      return {
        all: await loadCatalogProducts(db),
        scoped: await loadCatalogProducts(db, section!.id),
      };
    });

    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.length).toBeLessThan(all.length);
    expect(
      scoped.every((row) => row.section?.slug === FILTERED_SECTION_SLUG),
    ).toBe(true);
    // Ціни й характеристики приходять тим САМИМ запитом — інакше фільтри
    // каталогу після гідрації працювали б на порожніх даних.
    expect(scoped.some((row) => row.product_prices.length > 0)).toBe(true);
    expect(scoped.some((row) => row.propertyValues.length > 0)).toBe(true);
  });

  it('🔴 неактивний товар не потрапляє у вибірку каталогу — ні цілком, ні в розділі', async () => {
    const { all, scoped, byOption } = await withStorefrontDb(async (db) => {
      const section = await loadSectionBySlug(db, FILTERED_SECTION_SLUG);
      return {
        all: await loadCatalogProducts(db),
        scoped: await loadCatalogProducts(db, section!.id),
        byOption: await loadPropertyOption(
          db,
          PAGED_PROPERTY_SLUG,
          PAGED_OPTION_SLUG,
        ),
      };
    });

    for (const rows of [all, scoped, byOption!.products]) {
      expect(rows.map((row) => row.slug)).not.toContain(HIDDEN_PRODUCT_SLUG);
    }
  });

  it('вибірка каталогу несе наявність, а не складські рядки', async () => {
    const rows = await withStorefrontDb((db) => loadCatalogProducts(db));
    const modified = rows.find((row) => row.slug === MODIFIED_PRODUCT_SLUG);

    // Товар доступний, бо доступна ХОЧ ОДНА його модифікація.
    expect(modified?.isAvailable).toBe(true);
    expect(modified).not.toHaveProperty('stock_by_pickup_point');
    // Характеристика модифікації доклеєна до товару — на ній працює фільтр.
    expect(modified?.propertyValues.some((v) => v.option_id !== null)).toBe(
      true,
    );
  });

  it('наявність модифікацій рахується без функції get_stock_info', async () => {
    const { stock, values } = await withStorefrontDb(async (db) => {
      const [product] = (await queryRows(
        dbUrl,
        `select id from public.products where slug = $1`,
        [MODIFIED_PRODUCT_SLUG],
      )) as IdRow[];
      const ids = await loadModificationIds(db, product.id);
      return {
        stock: await loadModificationStock(db, ids),
        values: await loadProductModificationValues(db, product.id),
      };
    });

    const [withStock] = (await queryRows(
      dbUrl,
      `select m.id from public.product_modifications m
         join public.products p on p.id = m.product_id
        where p.slug = $1 and m.slug = $2`,
      [MODIFIED_PRODUCT_SLUG, IN_STOCK_MOD_SLUG],
    )) as IdRow[];
    const [without] = (await queryRows(
      dbUrl,
      `select m.id from public.product_modifications m
         join public.products p on p.id = m.product_id
        where p.slug = $1 and m.slug = $2`,
      [MODIFIED_PRODUCT_SLUG, OUT_OF_STOCK_MOD_SLUG],
    )) as IdRow[];

    expect(stock[withStock.id]).toEqual({
      totalQuantity: STOCK_QUANTITY,
      isAvailable: true,
    });
    // 🔴 Модифікація БЕЗ складського рядка мусить бути в мапі й недоступною:
    // її відсутність селектор показав би як «немає даних», а не «немає в наявності».
    expect(stock[without.id]).toEqual({ totalQuantity: 0, isAvailable: false });
    expect(values[withStock.id]?.[0].property?.slug).toBe('tip-invertora');
  });

  it('панель фільтрів розділу: характеристики й опції одним викликом', async () => {
    const { filters, numeric, options } = await withStorefrontDb(async (db) => {
      const section = await loadSectionBySlug(db, FILTERED_SECTION_SLUG);
      return {
        filters: await loadSectionFilters(db, section!.id),
        numeric: await loadSectionNumericProperties(db, section!.id),
        options: await loadFilterOptions(db),
      };
    });

    expect(filters.properties.map((row) => row.slug).sort()).toEqual([
      'potuzhnist',
      'tip-paneli',
    ]);
    // Опції доклеюються лише характеристикам-перелікам.
    const bySlug = new Map(filters.properties.map((p) => [p.slug, p.id]));
    expect(
      filters.optionsByProperty[bySlug.get('tip-paneli')!].length,
    ).toBeGreaterThan(0);
    expect(
      filters.optionsByProperty[bySlug.get('potuzhnist')!],
    ).toBeUndefined();

    expect(numeric.map((row) => row.slug)).toEqual(['potuzhnist']);
    expect(options.some((row) => row.section_properties !== null)).toBe(true);
  });
});
