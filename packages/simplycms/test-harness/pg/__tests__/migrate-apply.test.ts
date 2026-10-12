// Накат із журналом (К3-Е8, Е8-Р2; Review Focus п.5, п.6): журнал повний і з
// правильними сумами, повтор нічого не котить, `dryRun` нічого не створює,
// змінений накочений файл зупиняє накат ДО першого DDL, файл, що впав,
// відкочується цілком і в журнал не потрапляє.
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyMigrations,
  listMigrationFiles,
  MigrationChecksumError,
} from 'simplycms/migrate';
import { resolveHarness } from '../up.mjs';
import {
  CANON_DIR,
  canonCopy,
  canonNames,
  exists,
  freshDb,
  journalOf,
  numberOf,
} from './fixtures/migrate';

describe('applyMigrations: журнал і накат', () => {
  let harness: { url: string; teardown: () => Promise<void> };

  beforeAll(async () => {
    harness = await resolveHarness();
  }, 60_000);

  afterAll(async () => {
    await harness?.teardown();
  });

  it('чиста БД → увесь канон у журналі з сумами; повтор → нічого', async () => {
    const db = await freshDb(harness.url);
    try {
      const files = listMigrationFiles(CANON_DIR);
      const first = await applyMigrations({
        connectionString: db.url,
        dir: CANON_DIR,
      });
      expect(first.applied).toEqual(canonNames());
      expect(first.pending).toEqual([]);
      expect(await journalOf(db.url)).toEqual(
        files.map(({ name, checksum }) => ({ name, checksum })),
      );

      const again = await applyMigrations({
        connectionString: db.url,
        dir: CANON_DIR,
      });
      expect(again.applied).toEqual([]);
      expect(await journalOf(db.url)).toHaveLength(files.length);
    } finally {
      await db.drop();
    }
  }, 120_000);

  it('dryRun на чистій БД → pending = усі, у БД жодної таблиці', async () => {
    const db = await freshDb(harness.url);
    try {
      const report = await applyMigrations({
        connectionString: db.url,
        dir: CANON_DIR,
        dryRun: true,
      });
      expect(report).toEqual({
        applied: [],
        pending: canonNames(),
        runtimePasswordSynced: false,
      });
      expect(await exists(db.url, 'public.simplycms_migrations')).toBe(false);
      expect(
        await numberOf(
          db.url,
          `select count(*)::int as n from information_schema.tables
            where table_schema = 'public'`,
        ),
      ).toBe(0);
    } finally {
      await db.drop();
    }
  }, 120_000);

  it('змінений накочений файл + новий 0005 → MigrationChecksumError, нічого не накочено', async () => {
    const db = await freshDb(harness.url);
    const copy = canonCopy();
    try {
      await applyMigrations({ connectionString: db.url, dir: copy.dir });
      // Один зайвий байт у кінці накоченого файлу.
      const grants = readFileSync(join(copy.dir, '0002_grants.sql'), 'utf8');
      copy.write('0002_grants.sql', `${grants} `);
      copy.write('0005_x.sql', 'create table public.x_new (id int);');

      const err = await applyMigrations({
        connectionString: db.url,
        dir: copy.dir,
      }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(MigrationChecksumError);
      expect((err as MigrationChecksumError).names).toEqual([
        '0002_grants.sql',
      ]);
      expect((err as Error).message).toContain('0002_grants.sql');
      expect(await exists(db.url, 'public.x_new')).toBe(false);
      expect(await journalOf(db.url)).toHaveLength(canonNames().length);
    } finally {
      copy.cleanup();
      await db.drop();
    }
  }, 120_000);

  it('немонотонність: файл, доданий після накату, котиться наступним викликом', async () => {
    const db = await freshDb(harness.url);
    const copy = canonCopy();
    try {
      copy.write('0005_y.sql', 'create table public.y_core (id int);');
      await applyMigrations({ connectionString: db.url, dir: copy.dir });

      copy.write(
        '20260101000000_plg_x_init.sql',
        'create table public.plg_x (id int);',
      );
      const plugin = await applyMigrations({
        connectionString: db.url,
        dir: copy.dir,
      });
      expect(plugin.applied).toEqual(['20260101000000_plg_x_init.sql']);

      // Ім'я, що сортується ПЕРЕД уже накоченим плагінним, теж котиться:
      // журнал звіряє множину імен, а не «останнє накочене».
      copy.write('0006_z.sql', 'create table public.z_core (id int);');
      const core = await applyMigrations({
        connectionString: db.url,
        dir: copy.dir,
      });
      expect(core.applied).toEqual(['0006_z.sql']);
      for (const table of ['public.y_core', 'public.plg_x', 'public.z_core'])
        expect(await exists(db.url, table)).toBe(true);
    } finally {
      copy.cleanup();
      await db.drop();
    }
  }, 120_000);

  it('SQL-помилка в другому з двох нових файлів → перший у журналі, другий відкочено', async () => {
    const db = await freshDb(harness.url);
    const copy = canonCopy();
    try {
      await applyMigrations({ connectionString: db.url, dir: copy.dir });
      copy.write('0005_a.sql', 'create table public.a_ok (id int);');
      copy.write(
        '0006_b.sql',
        'create table public.b_bad (id int);\nselect * from public.no_such_table;',
      );

      await expect(
        applyMigrations({ connectionString: db.url, dir: copy.dir }),
      ).rejects.toThrow(/0006_b\.sql/);
      const names = (await journalOf(db.url)).map((row) => row.name);
      expect(names).toContain('0005_a.sql');
      expect(names).not.toContain('0006_b.sql');
      expect(await exists(db.url, 'public.a_ok')).toBe(true);
      expect(await exists(db.url, 'public.b_bad')).toBe(false);
    } finally {
      copy.cleanup();
      await db.drop();
    }
  }, 120_000);

  it('накочений файл, якого немає в теці → рядок у лозі, не помилка', async () => {
    const db = await freshDb(harness.url);
    const copy = canonCopy();
    try {
      copy.write('0005_gone.sql', 'create table public.gone (id int);');
      await applyMigrations({ connectionString: db.url, dir: copy.dir });
      rmSync(join(copy.dir, '0005_gone.sql'));
      const lines: string[] = [];
      const report = await applyMigrations({
        connectionString: db.url,
        dir: copy.dir,
        log: (line) => lines.push(line),
      });
      expect(report.applied).toEqual([]);
      expect(lines).toContain(
        '[migrate] файл 0005_gone.sql є в журналі, але відсутній у теці',
      );
    } finally {
      copy.cleanup();
      await db.drop();
    }
  }, 120_000);
});
