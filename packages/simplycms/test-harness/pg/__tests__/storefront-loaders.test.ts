// Інтеграційний гейт шару даних вітрини (В2-К1а): лоадери проти РЕАЛЬНОЇ БД.
//
// 🔴 Юніт із мок-клієнтом тут не працює за побудовою. Після переходу на
// Drizzle предикат видимості — це вже не рядок, який можна порівняти, а SQL,
// і єдиний спосіб довести «чернетка не поїхала у вітрину» — виконати запит
// на базі, де чернетка є. Тому весь контур живе в `pnpm test:schema`.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import {
  loadDefaultPriceTypeId,
  loadHomePageData,
  loadProduct,
  loadProductList,
  loadProperties,
  loadPropertyBySlug,
  loadPropertyOption,
  loadRootSections,
  loadSectionBySlug,
  loadSections,
  loadSitemapData,
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
  FILLED_SECTION_SLUG,
  FIXTURE_STATEMENTS,
  HIDDEN_PRODUCT_SLUG,
  HIDDEN_SECTION_SLUG,
  PAGED_OPTION_SLUG,
  PAGED_PROPERTY_SLUG,
  PER_SECTION_LIMIT,
  UNPAGED_PROPERTY_SLUG,
  VISIBLE_PRODUCT_SLUG,
} from './fixtures/storefront';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../migrations');

/** Канон у порядку імен + демо-сід — той самий список, що й у `demo-db.mjs`. */
const filesToApply = (): string[] => [
  ...readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(MIGRATIONS_DIR, name)),
  join(MIGRATIONS_DIR, 'demo/demo-seed.sql'),
];

describe('лоадери вітрини проти живого Postgres', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_storefront');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, filesToApply());
    for (const statement of FIXTURE_STATEMENTS) {
      await queryRows(dbUrl, statement);
    }
    // Як у проді: застосунок конектиться `app_runtime`, права дає лише
    // `SET LOCAL ROLE` всередині `withActor`.
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('каталог непорожній і не містить неактивного товару', async () => {
    const rows = await withStorefrontDb((db) => loadProductList(db));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((row) => row.slug)).not.toContain(HIDDEN_PRODUCT_SLUG);
    // Ціни й розділ приходять тим самим запитом — інакше картка списку не
    // мала б ні href, ні ціни в серверному HTML.
    expect(rows.some((row) => row.product_prices.length > 0)).toBe(true);
    expect(rows.some((row) => row.sections !== null)).toBe(true);
  });

  it('товар за slug приходить із розділом, цінами й характеристиками', async () => {
    const product = await withStorefrontDb((db) =>
      loadProduct(db, VISIBLE_PRODUCT_SLUG),
    );

    expect(product?.slug).toBe(VISIBLE_PRODUCT_SLUG);
    expect(product?.sections?.slug).toBe('sonyachni-paneli');
    expect(product?.product_prices.length).toBeGreaterThan(0);
    // `numeric` мусить приїхати числом, а не рядком драйвера.
    expect(typeof product?.product_prices[0].price).toBe('number');
    expect(product?.product_property_values.length).toBeGreaterThan(0);
  });

  it('неактивний товар недосяжний ні за slug, ні через розділ', async () => {
    const { hidden, inSection } = await withStorefrontDb(async (db) => {
      const section = await loadSectionBySlug(db, 'sonyachni-paneli');
      return {
        hidden: await loadProduct(db, HIDDEN_PRODUCT_SLUG),
        inSection: await loadProductList(db, section?.id),
      };
    });

    expect(hidden).toBeNull();
    expect(inSection.map((row) => row.slug)).not.toContain(HIDDEN_PRODUCT_SLUG);
  });

  it('неактивний розділ не видно ні в переліку, ні за slug', async () => {
    const { all, roots, direct } = await withStorefrontDb(async (db) => ({
      all: await loadSections(db),
      roots: await loadRootSections(db),
      direct: await loadSectionBySlug(db, HIDDEN_SECTION_SLUG),
    }));

    expect(all.length).toBeGreaterThan(0);
    expect(all.map((row) => row.slug)).not.toContain(HIDDEN_SECTION_SLUG);
    expect(roots.map((row) => row.slug)).not.toContain(HIDDEN_SECTION_SLUG);
    expect(direct).toBeNull();
  });

  it('головна: банери, добірки й товари розділів без неактивних', async () => {
    const data = await withStorefrontDb((db) => loadHomePageData(db));
    const filled = data.sections.find(
      (section) => section.slug === FILLED_SECTION_SLUG,
    );

    expect(data.banners.length).toBeGreaterThan(0);
    expect(data.featuredProducts.length).toBeGreaterThan(0);
    // Чернетка позначена `is_featured` — саме тому вона тут і показова.
    expect(data.featuredProducts.map((p) => p.slug)).not.toContain(
      HIDDEN_PRODUCT_SLUG,
    );
    expect(data.newProducts.map((p) => p.slug)).not.toContain(
      HIDDEN_PRODUCT_SLUG,
    );
    // Віконний зріз: рівно ліміт каруселі, скільки б товарів не було в розділі.
    expect(data.sectionProducts[filled!.id]).toHaveLength(PER_SECTION_LIMIT);
  });

  it('тип ціни за замовчуванням резолвиться з канонічного сіду', async () => {
    const priceTypeId = await withStorefrontDb((db) =>
      loadDefaultPriceTypeId(db),
    );

    expect(priceTypeId).toEqual(expect.any(String));
  });

  it('характеристики: лише ті, що мають публічну сторінку', async () => {
    const { list, paged, unpaged } = await withStorefrontDb(async (db) => ({
      list: await loadProperties(db),
      paged: await loadPropertyBySlug(db, PAGED_PROPERTY_SLUG),
      unpaged: await loadPropertyBySlug(db, UNPAGED_PROPERTY_SLUG),
    }));

    expect(list.map((row) => row.slug)).toEqual([PAGED_PROPERTY_SLUG]);
    expect(paged?.property_options.length).toBeGreaterThan(0);
    expect(unpaged).toBeNull();
  });

  it('sitemap бачить лише активні розділи й товари', async () => {
    const data = await withStorefrontDb((db) => loadSitemapData(db));

    expect(data.sections.length).toBeGreaterThan(0);
    expect(data.products.length).toBeGreaterThan(0);
    // 🔴 Головне, чого юніт із фікстурою довести не може: предикат `is_active`
    // живе в SQL, і саме тут видно, що чернетка й прихований розділ не поїхали
    // в мапу сайту — тобто робот не отримав запрошення на 404.
    expect(data.sections.map((row) => row.slug)).not.toContain(
      HIDDEN_SECTION_SLUG,
    );
    expect(data.products.map((row) => row.slug)).not.toContain(
      HIDDEN_PRODUCT_SLUG,
    );
    // URL товару будується з розділу — без нього посилання пішло б під
    // технічний `products`, тобто в нікуди.
    expect(
      data.products.find((row) => row.slug === VISIBLE_PRODUCT_SLUG)
        ?.section_slug,
    ).toBe('sonyachni-paneli');
    // `updated_at` мусить приїхати рядком ISO — саме він іде в `<lastmod>`.
    expect(data.products[0].updated_at).toEqual(expect.any(String));
  });

  it('сторінка значення характеристики не показує неактивних товарів', async () => {
    const data = await withStorefrontDb((db) =>
      loadPropertyOption(db, PAGED_PROPERTY_SLUG, PAGED_OPTION_SLUG),
    );

    expect(data?.option.slug).toBe(PAGED_OPTION_SLUG);
    expect(data?.products.length).toBeGreaterThan(0);
    expect(data?.products.map((row) => row.slug)).not.toContain(
      HIDDEN_PRODUCT_SLUG,
    );
  });
});
