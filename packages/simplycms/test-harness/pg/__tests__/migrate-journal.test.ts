// Журнал накату (К3-Е8, Е8-Р2): база зі схемою, але без журналу, накату не
// піддається; `readJournal` читає журнал з рантайм-підключення лише через
// `SET LOCAL ROLE app_admin` — прямого права `app_runtime` не має.
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyMigrations,
  readJournal,
  UnjournaledDatabaseError,
} from 'simplycms/migrate';
import { resolveHarness } from '../up.mjs';
import { applySqlFiles, queryRows, withUser } from '../apply.mjs';
import {
  CANON_DIR,
  canonCopy,
  canonNames,
  exists,
  freshDb,
  numberOf,
} from './fixtures/migrate';

const TABLES = `select count(*)::int as n from information_schema.tables
  where table_schema = 'public'`;

describe('журнал simplycms_migrations', () => {
  let harness: { url: string; teardown: () => Promise<void> };

  beforeAll(async () => {
    harness = await resolveHarness();
  }, 60_000);

  afterAll(async () => {
    await harness?.teardown();
  });

  it('схема без журналу → UnjournaledDatabaseError з підказкою, нічого не змінено', async () => {
    const db = await freshDb(harness.url);
    try {
      // Накат повз журнал — рівно та «адопція», яку накат відмовляється вгадувати.
      await applySqlFiles(
        db.url,
        canonNames().map((name) => join(CANON_DIR, name)),
      );
      const before = await numberOf(db.url, TABLES);

      const err = await applyMigrations({
        connectionString: db.url,
        dir: CANON_DIR,
      }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(UnjournaledDatabaseError);
      expect((err as Error).message).toContain(
        'перестворіть базу (`pnpm db:demo` локально); адопція бази без журналу не підтримується',
      );
      expect(await exists(db.url, 'public.simplycms_migrations')).toBe(false);
      expect(await numberOf(db.url, TABLES)).toBe(before);
      // Журналу немає — читач каже це `null`, а не порожнім списком.
      expect(await readJournal(withUser(db.url, 'app_runtime'))).toBeNull();
    } finally {
      await db.drop();
    }
  }, 120_000);

  it('readJournal під app_runtime читає рядки; прямий select — permission denied', async () => {
    const db = await freshDb(harness.url);
    try {
      await applyMigrations({ connectionString: db.url, dir: CANON_DIR });
      const runtime = withUser(db.url, 'app_runtime');

      const rows = await readJournal(runtime);
      expect(rows?.map((row) => row.name)).toEqual(canonNames());
      for (const row of rows ?? []) {
        expect(row.checksum).toMatch(/^[0-9a-f]{64}$/);
        expect(row.appliedAt).toBeInstanceOf(Date);
      }

      await expect(
        queryRows(runtime, 'select name from public.simplycms_migrations'),
      ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await db.drop();
    }
  }, 120_000);

  it('накат упав посередині → рядки, що встигли, читаються під app_runtime', async () => {
    // Вікно гранту: журнал створено, грант `app_admin` ставиться після накату;
    // без гранту й на шляху падіння `readJournal` кидав би 42501.
    const db = await freshDb(harness.url);
    const copy = canonCopy();
    try {
      copy.write('0005_b.sql', 'select * from public.no_such_table;');
      await expect(
        applyMigrations({ connectionString: db.url, dir: copy.dir }),
      ).rejects.toThrow(/0005_b\.sql/);
      const rows = await readJournal(withUser(db.url, 'app_runtime'));
      expect(rows?.map((row) => row.name)).toEqual(canonNames());
    } finally {
      copy.cleanup();
      await db.drop();
    }
  }, 120_000);
});
