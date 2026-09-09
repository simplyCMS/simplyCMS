// Гейт довідників доставки (В2-К1а, чекаут).
//
// 🔴 Головне, що доводиться тут, — фільтр `is_active`. RLS на цих таблицях
// НЕ ввімкнено (грант `select` для `app_user` — `0002_grants.sql`), політики
// «публічне читання» в новій моделі немає, тож видимість тримає виключно
// предикат у запиті. Загублений фільтр показав би покупцю вимкнений спосіб
// доставки — і дав би оформити замовлення на неіснуючий тариф. Довести це
// можна лише на базі, де вимкнені рядки справді є.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import {
  loadShippingDirectory,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';
import { resolveShippingRate } from 'simplycms/domain/shipping';
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
  ACTIVE_METHOD_CODE,
  ACTIVE_POINT_NAME,
  ACTIVE_ZONE_NAME,
  BASE_COST,
  FREE_FROM_AMOUNT,
  HIDDEN_METHOD_CODE,
  HIDDEN_POINT_NAME,
  HIDDEN_ZONE_NAME,
  SHIPPING_FIXTURES,
} from './fixtures/shipping';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');

describe('довідники доставки під актором вітрини', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_shipping');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(
      dbUrl,
      readdirSync(CANON_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort()
        .map((name) => join(CANON_DIR, name)),
    );
    for (const statement of SHIPPING_FIXTURES) {
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

  it('🔴 анонім читає довідники: способи, зони, тарифи, точки видачі', async () => {
    const directory = await withStorefrontDb((db) => loadShippingDirectory(db));

    expect(directory.methods.map((m) => m.code)).toEqual([ACTIVE_METHOD_CODE]);
    expect(directory.zones.map((z) => z.name)).toEqual([ACTIVE_ZONE_NAME]);
    expect(directory.rates).toHaveLength(1);
    expect(directory.pickupPoints.map((p) => p.name)).toEqual([
      ACTIVE_POINT_NAME,
    ]);
  });

  it('🔴 неактивні рядки не віддаються в жодному з чотирьох довідників', async () => {
    const directory = await withStorefrontDb((db) => loadShippingDirectory(db));

    expect(directory.methods.map((m) => m.code)).not.toContain(
      HIDDEN_METHOD_CODE,
    );
    expect(directory.zones.map((z) => z.name)).not.toContain(HIDDEN_ZONE_NAME);
    expect(directory.rates.map((r) => r.name)).not.toContain('Вимкнений тариф');
    expect(directory.pickupPoints.map((p) => p.name)).not.toContain(
      HIDDEN_POINT_NAME,
    );
    // Негативний контроль самого тесту: вимкнені рядки в БД справді є, тобто
    // очікування вище перевіряються не на порожній множині.
    const [{ hidden }] = (await queryRows(
      dbUrl,
      `select count(*)::int as hidden from public.shipping_methods where is_active = false`,
    )) as Array<{ hidden: number }>;
    expect(hidden).toBe(1);
  });

  it('🔴 грошові колонки приїжджають ЧИСЛАМИ, а не рядками numeric', async () => {
    const directory = await withStorefrontDb((db) => loadShippingDirectory(db));
    const [rate] = directory.rates;

    expect(rate.base_cost).toBe(BASE_COST);
    expect(rate.free_from_amount).toBe(FREE_FROM_AMOUNT);
    expect(typeof rate.base_cost).toBe('number');
  });

  it('домен рахує вартість на РЕАЛЬНОМУ рядку тарифу', async () => {
    const directory = await withStorefrontDb((db) => loadShippingDirectory(db));
    const method = directory.methods[0];
    const zone = directory.zones[0];

    const below = resolveShippingRate(
      { method, zone, cart: { items: [], subtotal: FREE_FROM_AMOUNT - 1 } },
      directory.rates,
    );
    const above = resolveShippingRate(
      { method, zone, cart: { items: [], subtotal: FREE_FROM_AMOUNT } },
      directory.rates,
    );

    expect(below?.cost).toBe(BASE_COST);
    expect(above?.cost).toBe(0);
  });
});
