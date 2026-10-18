// Доказ оновлюваності 1.0 (К3-Е8, Task 14): магазин із даними переживає
// наступну версію платформи. «Наступна версія» тут — канон + дві нові
// append-only міграції (`0005`/`0006`); змінений уже накочений `0004` має
// зупиняти накат і старт контейнера, не зачепивши дані.
//
// Кейси йдуть ПОСЛІДОВНО на одній БД (знімок лічильників беремо раз після
// підготовки): другий кейс спирається на стан після першого. Файл у проєкті
// `pg` без Mailpit: лист замовлення йде у лог-драйвер.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeDbPool, withActor } from 'simplycms/db';
import { applyMigrations, MigrationChecksumError } from 'simplycms/migrate';
import { placeOrderFor } from 'simplycms/storefront/loaders';
import { localFsDriver, writeMedia } from 'simplycms/storage';
import { runStart } from 'simplycms/prod-start';
import { resolveDriverEnv } from 'simplycms/env';
import { resolveHarness } from '../up.mjs';
import {
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';
import { canonCopy, canonNames, journalOf } from './fixtures/migrate';
import { order, PNG, seedStore } from './fixtures/upgrade-1x';
import { UK } from './fixtures/text-locale';

const TABLES = [
  'orders',
  'order_items',
  'products',
  'users',
  'media',
  'mail_outbox',
] as const;

describe('оновлюваність 1.0: магазин із даними і наступна версія', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_upgrade_1x');
  let dbUrl = '';
  let mediaRoot = '';
  let prevEnv: Record<string, string | undefined> = {};
  let snapshot: Record<string, number> = {};
  const canon = canonCopy();

  const counts = async () => {
    const out: Record<string, number> = {};
    for (const table of TABLES) {
      const [row] = (await queryRows(
        dbUrl,
        `select count(*)::int as n from public.${table}`,
      )) as { n: number }[];
      out[table] = row!.n;
    }
    return out;
  };

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    const { pickup, point, product } = await seedStore(dbUrl);
    // Env і пул відновлюємо в afterAll: файл не повинен зачепити сусідні.
    prevEnv = {
      DATABASE_URL: process.env.DATABASE_URL,
      VITE_SITE_URL: process.env.VITE_SITE_URL,
    };
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
    process.env.VITE_SITE_URL = 'https://shop.example.test';
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const placed = await placeOrderFor(
      {
        ...order([{ productId: product, modificationId: null, quantity: 1 }]),
        shippingMethodId: pickup,
        pickupPointId: point,
      },
      null,
      UK,
    );
    expect(placed.ok).toBe(true);
    // Файл у фейковому (локальному tmp) сховищі + рядок media.
    mediaRoot = mkdtempSync(join(tmpdir(), 'simplycms-upgrade-media-'));
    await withActor({ role: 'app_admin' }, (db) =>
      writeMedia(
        db,
        {
          bytes: PNG,
          mime: 'image/png',
          entityType: 'product',
          entityId: product,
          uploadedBy: null,
        },
        localFsDriver(mediaRoot),
      ),
    );
    snapshot = await counts();
    // mail_outbox може бути порожнім (лог-драйвер): його незмінність теж перевіряється.
    for (const table of TABLES.filter((t) => t !== 'mail_outbox'))
      expect(snapshot[table]).toBeGreaterThan(0);
    canon.write(
      '0005_e8_probe_column.sql',
      'alter table products add column e8_probe text;\n',
    );
    canon.write(
      '0006_e8_probe_backfill.sql',
      'update products set e8_probe = id::text;\n',
    );
  }, 180_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await closeDbPool();
    for (const [key, value] of Object.entries(prevEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    canon.cleanup();
    if (mediaRoot) rmSync(mediaRoot, { recursive: true, force: true });
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('нові 0005/0006 накочуються, дані цілі, backfill заповнив усі рядки', async () => {
    const report = await applyMigrations({
      connectionString: dbUrl,
      dir: canon.dir,
    });
    expect(report.applied).toEqual([
      '0005_e8_probe_column.sql',
      '0006_e8_probe_backfill.sql',
    ]);
    expect((await journalOf(dbUrl)).map((r) => r.name)).toEqual([
      ...canonNames(),
      '0005_e8_probe_column.sql',
      '0006_e8_probe_backfill.sql',
    ]);
    expect(await counts()).toEqual(snapshot);
    const [unfilled] = (await queryRows(
      dbUrl,
      'select count(*)::int as n from public.products where e8_probe is distinct from id::text',
    )) as { n: number }[];
    expect(unfilled!.n).toBe(0);
  });

  it('повторний накат нічого не накочує', async () => {
    // Довжина журналу ДО виклику: без запису рядків падає тут явним асертом.
    expect(await journalOf(dbUrl)).toHaveLength(canonNames().length + 2);
    const report = await applyMigrations({
      connectionString: dbUrl,
      dir: canon.dir,
    });
    expect(report.applied).toEqual([]);
    expect(await journalOf(dbUrl)).toHaveLength(canonNames().length + 2);
  });

  describe('змінений уже накочений 0004', () => {
    const tampered = () => {
      canon.write(
        '0004_functions.sql',
        `${readFileSync(join(canon.dir, '0004_functions.sql'), 'utf8')}\n-- правка після накату\n`,
      );
    };

    it('applyMigrations кидає MigrationChecksumError; журнал і дані не змінені', async () => {
      const journalBefore = await journalOf(dbUrl);
      tampered();
      const error = await applyMigrations({
        connectionString: dbUrl,
        dir: canon.dir,
      }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(MigrationChecksumError);
      expect((error as MigrationChecksumError).names).toEqual([
        '0004_functions.sql',
      ]);
      expect(await journalOf(dbUrl)).toEqual(journalBefore);
      expect(await counts()).toEqual(snapshot);
    });

    it('runStart: код 1, execve не викликано — контейнер не стартує', async () => {
      const storeDir = mkdtempSync(join(tmpdir(), 'simplycms-upgrade-store-'));
      try {
        mkdirSync(join(storeDir, 'db'), { recursive: true });
        cpSync(canon.dir, join(storeDir, 'db/migrations'), { recursive: true });
        const execve = vi.fn();
        const logs: string[] = [];
        const code = await runStart({
          env: {
            DATABASE_URL: withUser(dbUrl, 'app_runtime'),
            MIGRATION_DATABASE_URL: dbUrl,
            PATH: '/usr/bin',
          },
          cwd: storeDir,
          migrate: applyMigrations,
          resolveDriverEnv,
          execve,
          log: (m: string) => logs.push(m),
        });
        expect(code).toBe(1);
        expect(execve).not.toHaveBeenCalled();
        expect(logs.join('\n')).toContain('0004_functions.sql');
        expect(await counts()).toEqual(snapshot);
      } finally {
        rmSync(storeDir, { recursive: true, force: true });
      }
    });
  });
});
