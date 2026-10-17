// Інтеграційний гейт шару даних вітрини (В2-К1а): лоадери проти РЕАЛЬНОЇ БД.
//
// 🔴 Юніт із мок-клієнтом тут не працює за побудовою. Після переходу на
// Drizzle предикат видимості — це вже не рядок, який можна порівняти, а SQL,
// і єдиний спосіб довести «чернетка не поїхала у вітрину» — виконати запит
// на базі, де чернетка є. Тому весь контур живе в `pnpm test:schema`.
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { loadDefaultPriceTypeId } from 'simplycms/commerce';
import {
  loadBanners,
  loadHomePageData,
  loadHomeProducts,
  loadOneSectionProducts,
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
// Ядро `withViewerDb` без сесії — поза публічним барелем (Р29, M1).
import { withViewerPricesDb } from '../../../src/storefront/loaders/viewer-prices-db';
import { resolveHarness } from '../up.mjs';
import {
  applyCanon,
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

/** Не-міграційний SQL поверх канону (канон котить `applyCanon`). */
const DEMO_SEED_FILE = join(MIGRATIONS_DIR, 'demo/demo-seed.sql');

describe('лоадери вітрини проти живого Postgres', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_storefront');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applyCanon(dbUrl);
    await applySqlFiles(dbUrl, [DEMO_SEED_FILE]);
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
    const rows = await withViewerPricesDb(null, (db, v) =>
      loadProductList(db, v),
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((row) => row.slug)).not.toContain(HIDDEN_PRODUCT_SLUG);
    // Ціни й розділ приходять тим самим запитом — інакше картка списку не
    // мала б ні href, ні ціни в серверному HTML.
    expect(rows.some((row) => row.product_prices.length > 0)).toBe(true);
    expect(rows.some((row) => row.sections !== null)).toBe(true);
  });

  it('товар за slug приходить із розділом, цінами й характеристиками', async () => {
    const product = await withViewerPricesDb(null, (db, v) =>
      loadProduct(db, { locale: 'uk', path: VISIBLE_PRODUCT_SLUG }, v),
    );

    expect(product?.slug).toBe(VISIBLE_PRODUCT_SLUG);
    expect(product?.sections?.slug).toBe('sonyachni-paneli');
    expect(product?.product_prices.length).toBeGreaterThan(0);
    // `numeric` мусить приїхати числом, а не рядком драйвера.
    expect(typeof product?.product_prices[0].price).toBe('number');
    expect(product?.product_property_values.length).toBeGreaterThan(0);
  });

  it('неактивний товар недосяжний ні за slug, ні через розділ', async () => {
    const { hidden, inSection } = await withViewerPricesDb(
      null,
      async (db, v) => {
        const section = await loadSectionBySlug(db, 'sonyachni-paneli');
        return {
          hidden: await loadProduct(
            db,
            { locale: 'uk', path: HIDDEN_PRODUCT_SLUG },
            v,
          ),
          inSection: await loadProductList(db, v, section?.id),
        };
      },
    );

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

  it('демо-банер віддається з однією валідною кнопкою; кнопка javascript: відфільтрована', async () => {
    const demo = await withStorefrontDb((db) =>
      loadBanners(db, { placement: 'home' }),
    );
    const sun = demo.find((b) => b.title === 'Сонячна енергія для вашого дому');
    expect(sun?.buttons).toHaveLength(1);
    expect(sun?.buttons[0]).toMatchObject({
      text: 'До каталогу',
      url: '/catalog',
    });
    // Другий демо-банер — home без розділу (інакше суперечить guard Task 3).
    const sale = demo.find((b) => b.title === 'Знижки на бі-фаціальні панелі');
    expect(sale?.section_id).toBeNull();

    // Прямий SQL повз форму: небезпечна кнопка не доходить до вітрини.
    await queryRows(
      dbUrl,
      `insert into public.banners (id, title, image_url, placement, sort_order, is_active, buttons)
       values ('10000009-0000-4000-8000-0000000000e1'::uuid, 'XSS-банер', 'data:,x', 'global', 0, true,
       '[{"text":"x","url":"javascript:alert(1)","target":"_self","variant":"primary"}]'::jsonb)`,
    );
    const global = await withStorefrontDb((db) =>
      loadBanners(db, { placement: 'global' }),
    );
    expect(global.find((b) => b.title === 'XSS-банер')?.buttons).toEqual([]);
  });

  it('розклад: банер 09:00:00–17:00:00 видимий рівно о 09:00 (хвилинна точність)', async () => {
    await queryRows(
      dbUrl,
      `insert into public.banners (id, title, image_url, placement, sort_order, is_active, buttons, schedule_time_from, schedule_time_to)
       values ('10000009-0000-4000-8000-0000000000e2'::uuid, 'Розклад-банер', 'data:,x', 'blog', 0, true, '[]'::jsonb, '09:00:00', '17:00:00')`,
    );
    const at = (h: number, m: number) => new Date(2026, 0, 5, h, m, 30);
    const titles = async (now: Date) =>
      (
        await withStorefrontDb((db) =>
          loadBanners(db, { placement: 'blog' }, now),
        )
      ).map((b) => b.title);
    expect(await titles(at(9, 0))).toContain('Розклад-банер');
    expect(await titles(at(8, 59))).not.toContain('Розклад-банер');
  });

  it('головна: банери, добірки й товари розділів без неактивних', async () => {
    const data = await withViewerPricesDb(null, (db, v) =>
      loadHomePageData(db, v),
    );
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

  it('головна: у banners лише розміщення home у межах розкладу (Р24)', async () => {
    await queryRows(
      dbUrl,
      `insert into public.banners (id, title, image_url, placement, sort_order, is_active, date_from)
       values
         ('10000009-0000-4000-8000-0000000000f1'::uuid, 'Р24-каталог', 'data:,x', 'catalog', 0, true, null),
         ('10000009-0000-4000-8000-0000000000f2'::uuid, 'Р24-майбутнє', 'data:,x', 'home', 0, true, now() + interval '1 year'),
         ('10000009-0000-4000-8000-0000000000f3'::uuid, 'Р24-чинний', 'data:,x', 'home', 0, true, now() - interval '1 day')`,
    );
    const data = await withViewerPricesDb(null, (db, v) =>
      loadHomePageData(db, v),
    );
    const titles = data.banners.map((b) => b.title);
    expect(titles).toContain('Р24-чинний');
    expect(titles).not.toContain('Р24-каталог');
    expect(titles).not.toContain('Р24-майбутнє');
  });

  it('головна: ціна картки — той самий резолв, що в каталозі (К2-Е0)', async () => {
    const { featured, panels } = await withViewerPricesDb(
      null,
      async (db, v) => {
        const section = await loadSectionBySlug(db, 'sonyachni-paneli');
        return {
          featured: await loadHomeProducts(db, true, v),
          // Розділ панелей ДОЧІРНІЙ до `sonyachna-energetyka`, тож кореневі
          // бакети `loadSectionProducts` цих товарів не містять — беремо його
          // напряму, як клієнтський перезапит каруселі.
          panels: await loadOneSectionProducts(db, section!, v),
        };
      },
    );

    // П'ять сідових товарів мають `is_featured = true`; фікстурні наповнювачі
    // — ні, тож набір під лімітом 12 детермінований незалежно від порядку.
    expect(featured).toHaveLength(5);

    const priceOf = (rows: typeof featured, slug: string) =>
      rows.find((row) => row.slug === slug);

    expect(priceOf(featured, 'sonyachna-panel-450w-mono')).toMatchObject({
      price: 4800,
      old_price: null,
    });
    expect(priceOf(featured, 'sonyachna-panel-600w-bifacial')).toMatchObject({
      price: 7200,
      old_price: 8100,
    });
    expect(priceOf(panels, 'sonyachna-panel-450w-mono')).toMatchObject({
      price: 4800,
      old_price: null,
    });
    expect(priceOf(panels, 'sonyachna-panel-600w-bifacial')).toMatchObject({
      price: 7200,
      old_price: 8100,
    });
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
    const paths = data.products.flatMap((row) =>
      row.languages.map((v) => v.path),
    );
    expect(paths).not.toContain(HIDDEN_PRODUCT_SLUG);
    // Адреса товару — з реєстру в мові версії, а не slug розділу: URL не
    // залежить від того, у якому розділі лежить товар.
    const visible = data.products.find((row) =>
      row.languages.some((v) => v.path === VISIBLE_PRODUCT_SLUG),
    );
    expect(visible?.primary).toBe('uk');
    expect(visible?.languages).toContainEqual({
      code: 'uk',
      path: VISIBLE_PRODUCT_SLUG,
      isTranslated: true,
    });
    // `updated_at` — Date (контракт К2-Е0): рядком він стає лише в
    // `<lastmod>` через toISOString(). Регекс ФОРМАТУ драйвера тут пінив би
    // GUC кластера, а не код.
    expect(data.products[0].updated_at).toBeInstanceOf(Date);
  });

  it('сторінка значення характеристики не показує неактивних товарів', async () => {
    const data = await withViewerPricesDb(null, (db, v) =>
      loadPropertyOption(db, PAGED_PROPERTY_SLUG, PAGED_OPTION_SLUG, v),
    );

    expect(data?.option.slug).toBe(PAGED_OPTION_SLUG);
    expect(data?.products.length).toBeGreaterThan(0);
    expect(data?.products.map((row) => row.slug)).not.toContain(
      HIDDEN_PRODUCT_SLUG,
    );
  });
});
