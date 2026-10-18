// Демо-сід (`migrations/demo/demo-seed.sql`) поверх канону — доказ, що
// «магазин видно» не протухає разом зі схемою.
//
// 🔴 Демо НЕ є частиною канону (склад канону — рівно 4 файли, `baseline.test.ts`
// стереже це число), тож тут своя тимчасова БД і свій накат: канон + демо
// одним списком. Ідемпотентність — та сама вимога, що й для канону: докат
// файлу вдруге не має міняти лічильники (демо-файл теж описує це в шапці).
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { reconcileProductTexts } from 'simplycms/catalog-projection';
import { closeDbPool, withActor } from 'simplycms/db';
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

const ADMIN = {
  role: 'app_admin',
  userId: '33333333-3333-4333-8333-333333333333',
} as const;

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../migrations');
const DEMO_FILE = join(MIGRATIONS_DIR, 'demo/demo-seed.sql');

describe('демо-сід: накат поверх канону', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_demo_seed');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applyCanon(dbUrl);
    await applySqlFiles(dbUrl, [DEMO_FILE]);
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  const counts = async () => ({
    sections: (await queryRows(dbUrl, 'select id from public.sections')).length,
    products: (await queryRows(dbUrl, 'select id from public.products')).length,
    prices: (await queryRows(dbUrl, 'select id from public.product_prices'))
      .length,
    modifications: (
      await queryRows(dbUrl, 'select id from public.product_modifications')
    ).length,
    banners: (await queryRows(dbUrl, 'select id from public.banners')).length,
    // К2-Е0: доставка й залишки — вставки секції 10 з нетривіальними
    // формами `on conflict` (частковий індекс залишків) доводять тут
    // ідемпотентність (кейс нижче). Зону доставки демо-сід не вставляє:
    // основну дає `0003_seed`, тож `shippingZones` лишається сталим.
    shippingMethods: (
      await queryRows(dbUrl, 'select id from public.shipping_methods')
    ).length,
    shippingZones: (
      await queryRows(dbUrl, 'select id from public.shipping_zones')
    ).length,
    shippingRates: (
      await queryRows(dbUrl, 'select id from public.shipping_rates')
    ).length,
    pickupPoints: (
      await queryRows(dbUrl, 'select id from public.pickup_points')
    ).length,
    stockByPickupPoint: (
      await queryRows(dbUrl, 'select id from public.stock_by_pickup_point')
    ).length,
    // М1 Task 10: переклади, адреси й токени теж не плодяться при докаті.
    productTranslations: (
      await queryRows(dbUrl, 'select 1 from public.product_translations')
    ).length,
    modificationTranslations: (
      await queryRows(
        dbUrl,
        'select 1 from public.product_modification_translations',
      )
    ).length,
    urlPaths: (await queryRows(dbUrl, 'select id from public.url_paths'))
      .length,
    slugTokens: (await queryRows(dbUrl, 'select id from public.slug_tokens'))
      .length,
  });

  it('накатується без помилок і дає непорожній каталог', async () => {
    const c = await counts();
    expect(c.sections).toBeGreaterThanOrEqual(3);
    expect(c.products).toBeGreaterThanOrEqual(6);
    expect(c.products).toBeLessThanOrEqual(10);
    expect(c.prices).toBeGreaterThan(0);
    expect(c.modifications).toBeGreaterThan(0);
    expect(c.banners).toBeGreaterThan(0);
  });

  // М1 Task 10 (майстер §3.1): без перекладу основної мови товар не має назви на
  // вітрині, без поточної адреси — URL. Модифікація дзеркально: переклад і токен.
  it('кожен демо-товар має переклад основною мовою й поточну адресу', async () => {
    const missing = await queryRows(
      dbUrl,
      `select p.id from public.products p
        where not exists (
                select 1 from public.product_translations t
                  join public.languages l on l.code = t.locale and l.is_default
                 where t.product_id = p.id and nullif(btrim(t.name), '') is not null)
           or not exists (
                select 1 from public.url_paths u
                  join public.languages l on l.code = u.locale and l.is_default
                 where u.product_id = p.id and u.is_current)`,
    );
    expect(missing).toEqual([]);
  });

  it('кожна демо-модифікація має переклад основною мовою й поточний токен', async () => {
    const missing = await queryRows(
      dbUrl,
      `select m.id from public.product_modifications m
        where not exists (
                select 1 from public.product_modification_translations t
                  join public.languages l on l.code = t.locale and l.is_default
                 where t.modification_id = m.id and nullif(btrim(t.name), '') is not null)
           or not exists (
                select 1 from public.slug_tokens s
                  join public.languages l on l.code = s.locale and l.is_default
                 where s.modification_id = m.id and s.scope_id = m.product_id
                   and s.is_current)`,
    );
    expect(missing).toEqual([]);
  });

  // М1 Task 17: проєкція тексту, яку сід пише сам, — та сама, що дала б команда (І23).
  it('звірка проєкції після демо-сіду: розбіжностей 0', async () => {
    expect(
      await withActor(ADMIN, (d) => reconcileProductTexts(d, { limit: 1000 })),
    ).toEqual({ mismatched: 0, fixed: 0 });
  });

  it('дерево секцій: є батьківська й дочірні', async () => {
    const roots = await queryRows(
      dbUrl,
      'select slug from public.sections where parent_id is null order by slug',
    );
    const children = await queryRows(
      dbUrl,
      'select slug from public.sections where parent_id is not null',
    );
    expect(roots.length).toBeGreaterThanOrEqual(2);
    expect(children.length).toBeGreaterThanOrEqual(2);
  });

  it("усі активні товари прив'язані до секцій і мають ціну", async () => {
    const orphanProducts = await queryRows(
      dbUrl,
      `select id from public.products where is_active and section_id is null`,
    );
    expect(orphanProducts).toHaveLength(0);

    const withoutPrice = await queryRows(
      dbUrl,
      `select p.id from public.products p
        where p.is_active
          and not exists (
            select 1 from public.product_prices pp where pp.product_id = p.id
          )`,
    );
    expect(withoutPrice).toHaveLength(0);
  });

  it('демо не містить персональних даних чи замовлень', async () => {
    for (const table of [
      'orders',
      'order_items',
      'profiles',
      'users',
      'user_addresses',
      'user_recipients',
    ]) {
      const rows = await queryRows(dbUrl, `select 1 from public.${table}`);
      expect(rows).toHaveLength(0);
    }
  });

  it('ідемпотентний: повторний докат демо-файлу не міняє лічильники', async () => {
    const before = await counts();
    await applySqlFiles(dbUrl, [DEMO_FILE]);
    expect(await counts()).toEqual(before);
  }, 60_000);

  // 🔴 Лічильники рядків тумблер `decrease_on_order` НЕ покривають: він їде
  // `update`-ом канонічного рядка, а не `insert`-ом, тож повторний накат із
  // зіпсованим предикатом лишив би лічильники незмінними й зеленими. Асерт
  // на ЗНАЧЕННЯ — єдине, що ловить це в гейті, а не в ручному psql.
  it('вмикає облік списання і лишає його увімкненим після повторного накату', async () => {
    const read = async () =>
      (
        await queryRows(
          dbUrl,
          "select value->>'decrease_on_order' as v from public.system_settings where key = 'stock_management'",
        )
      )[0]?.v;
    expect(await read()).toBe('true');
    await applySqlFiles(dbUrl, [DEMO_FILE]);
    expect(await read()).toBe('true');
  }, 60_000);

  // Е6б-5: демо переписує профіль UPDATE-ом канонічного рядка (INSERT дав би
  // конфлікт ключа або зайвий INSERT у seed-determinism).
  it('переписує store_profile демо-значеннями, один рядок', async () => {
    const rows = await queryRows(
      dbUrl,
      "select value->>'name' as name, jsonb_array_length(value->'socials') as socials from public.system_settings where key = 'store_profile'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('SolarStore');
    expect(Number(rows[0]?.socials)).toBe(2);
  }, 60_000);
});
