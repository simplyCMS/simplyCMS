// `readStoreProfile` проти живого Postgres (К3-Е6б, Task 2, Review Focus 1):
// відсутній чи зіпсований рядок `store_profile` — порожній профіль, не помилка.
import { readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool, withActor } from 'simplycms/db';
import { EMPTY_STORE_PROFILE } from 'simplycms/domain/store-profile';
import { readStoreProfile, toStorefrontProfile } from 'simplycms/site';
import { resolveHarness } from '../up.mjs';
import * as H from '../apply.mjs';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');

describe('readStoreProfile проти живого Postgres', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = H.randomDbName('simplycms_site_profile');
  let dbUrl = '';

  beforeAll(async () => {
    harness = await resolveHarness();
    await H.createTempDatabase(harness.url, dbName);
    dbUrl = H.withDbName(harness.url, dbName);
    await H.applySqlFiles(
      dbUrl,
      readdirSync(CANON_DIR)
        .filter((n) => n.endsWith('.sql'))
        .sort()
        .map((n) => join(CANON_DIR, n)),
    );
    process.env.DATABASE_URL = H.withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    await H.dropTempDatabase(harness.url, dbName);
    await harness.teardown();
  });

  const read = () =>
    withActor({ role: 'app_user' }, (db) => readStoreProfile(db));

  it('рядка немає → EMPTY_STORE_PROFILE, а logoUrl: null', async () => {
    // Baseline засіває рядок — прибираємо його, як ручний SQL чи старий дамп.
    await H.queryRows(
      dbUrl,
      `delete from public.system_settings where key = 'store_profile'`,
    );
    const profile = await read();
    expect(profile).toEqual(EMPTY_STORE_PROFILE);
    expect(toStorefrontProfile(profile).logoUrl).toBeNull();
  });

  it('зіпсоване значення (рядок замість обʼєкта) → EMPTY_STORE_PROFILE', async () => {
    await H.queryRows(
      dbUrl,
      `insert into public.system_settings (id, key, value) values ($1, 'store_profile', '"x"'::jsonb)`,
      [randomUUID()],
    );
    expect(await read()).toEqual(EMPTY_STORE_PROFILE);
  });

  it('валідне значення читається', async () => {
    await H.queryRows(
      dbUrl,
      `update public.system_settings set value = $1::jsonb where key = 'store_profile'`,
      [JSON.stringify({ name: 'Мій магазин' })],
    );
    expect((await read()).name).toBe('Мій магазин');
  });
});
