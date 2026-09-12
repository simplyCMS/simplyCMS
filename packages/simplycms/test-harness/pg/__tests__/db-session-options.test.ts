// Детермінованість текстового формату дат — властивість пулу, не кластера
// (К2-Е0, Е0-2). Без startup-опцій формат залежав би від DateStyle/TimeZone
// того Postgres, де живе магазин.
//
// 🔴 Self-contained, як with-actor.test.ts: роль `app_runtime` створює канон
// (`0000_prelude.sql`), на голому кластері (ефемерний initdb, свіжий
// service-контейнер CI) її немає — без тимчасової БД з накатаним каноном
// `connect()` падає з «role "app_runtime" does not exist».
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { withStorefrontDb } from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');

describe('пул: DateStyle/TimeZone зʼєднання', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_session_opts');
  let dbUrl = '';

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(
      dbUrl,
      readdirSync(CANON_DIR)
        .filter((n) => n.endsWith('.sql'))
        .sort()
        .map((n) => join(CANON_DIR, n)),
    );
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    await dropTempDatabase(harness.url, dbName);
    await harness.teardown();
  });

  it('кожне зʼєднання пулу — ISO, YMD і UTC незалежно від дефолтів кластера', async () => {
    const rows = await withStorefrontDb(async (db) => {
      const style = await db.execute(sql`show DateStyle`);
      const tz = await db.execute(sql`show TimeZone`);
      return { style: style.rows[0], tz: tz.rows[0] };
    });
    expect(rows.style).toEqual({ DateStyle: 'ISO, YMD' });
    expect(rows.tz).toEqual({ TimeZone: 'UTC' });
  });
});
