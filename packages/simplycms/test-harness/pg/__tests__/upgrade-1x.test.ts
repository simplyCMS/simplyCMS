// Доказ оновлюваності 1.0 (К3-Е8, Task 14): магазин із даними переживає
// наступну версію платформи. «Наступна версія» тут — канон + дві нові
// append-only міграції (`0006`/`0007`); змінений уже накочений `0005` має
// зупиняти накат і старт контейнера, не зачепивши дані.
//
// Кейси йдуть ПОСЛІДОВНО на одній БД (знімок лічильників беремо раз після
// підготовки): другий кейс спирається на стан після першого. Файл у проєкті
// `pg` без Mailpit: лист замовлення йде у лог-драйвер.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeDbPool, withActor } from 'simplycms/db';
import type { PlaceOrderInput } from 'simplycms/contracts';
import { applyMigrations, MigrationChecksumError } from 'simplycms/migrate';
import { placeOrderFor } from 'simplycms/storefront/loaders';
import { localFsDriver, writeMedia } from 'simplycms/storage';
import { runStart } from '../../../../create-simplycms-store/template/scripts/start-core.mjs';
import { resolveDriverEnv } from 'simplycms/env';
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
import { canonCopy, canonNames, journalOf } from './fixtures/migrate';

const DEMO = join(
  import.meta.dirname,
  '../../../migrations/demo/demo-seed.sql',
);
const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1,
]);
const TABLES = ['orders', 'order_items', 'products', 'users', 'media'] as const;

const order = (items: PlaceOrderInput['items']): PlaceOrderInput => ({
  firstName: 'Тест',
  lastName: 'Покупець',
  email: 'upgrade@example.test',
  phone: '+380000000000',
  shippingMethodId: '',
  deliveryCity: null,
  deliveryAddress: null,
  pickupPointId: null,
  paymentMethod: 'cash',
  notes: null,
  hasDifferentRecipient: false,
  recipientFirstName: null,
  recipientLastName: null,
  recipientPhone: null,
  recipientEmail: null,
  recipientCity: null,
  recipientAddress: null,
  recipientNotes: null,
  saveRecipient: false,
  savedRecipientId: null,
  savedAddressId: null,
  items,
});

describe('оновлюваність 1.0: магазин із даними і наступна версія', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_upgrade_1x');
  let dbUrl = '';
  let mediaRoot = '';
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
    await applyCanon(dbUrl);
    await applySqlFiles(dbUrl, [DEMO]);
    const id = async (sql: string) =>
      ((await queryRows(dbUrl, sql)) as { id: string }[])[0]!.id;
    const pickup = await id(
      `select id from public.shipping_methods where code = 'pickup'`,
    );
    const point = await id(
      `select id from public.pickup_points where name = 'Склад у Києві'`,
    );
    const product = await id(
      `select id from public.products where slug = 'invertor-gibrydnyi-8kw'`,
    );
    await queryRows(
      dbUrl,
      `insert into public.users (id, name, email, email_verified)
       values (gen_random_uuid(), 'Покупець', 'buyer-upgrade@example.test', true)`,
    );
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
    for (const table of TABLES) expect(snapshot[table]).toBeGreaterThan(0);
    canon.write(
      '0006_e8_probe_column.sql',
      'alter table products add column e8_probe text;\n',
    );
    canon.write(
      '0007_e8_probe_backfill.sql',
      'update products set e8_probe = slug;\n',
    );
  }, 180_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await closeDbPool();
    delete process.env.DATABASE_URL;
    delete process.env.VITE_SITE_URL;
    canon.cleanup();
    if (mediaRoot) rmSync(mediaRoot, { recursive: true, force: true });
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('нові 0006/0007 накочуються, дані цілі, backfill заповнив усі рядки', async () => {
    const report = await applyMigrations({
      connectionString: dbUrl,
      dir: canon.dir,
    });
    expect(report.applied).toEqual([
      '0006_e8_probe_column.sql',
      '0007_e8_probe_backfill.sql',
    ]);
    expect((await journalOf(dbUrl)).map((r) => r.name)).toEqual([
      ...canonNames(),
      '0006_e8_probe_column.sql',
      '0007_e8_probe_backfill.sql',
    ]);
    expect(await counts()).toEqual(snapshot);
    const [unfilled] = (await queryRows(
      dbUrl,
      'select count(*)::int as n from public.products where e8_probe is distinct from slug',
    )) as { n: number }[];
    expect(unfilled!.n).toBe(0);
  });

  it('повторний накат нічого не накочує', async () => {
    const report = await applyMigrations({
      connectionString: dbUrl,
      dir: canon.dir,
    });
    expect(report.applied).toEqual([]);
    expect(await journalOf(dbUrl)).toHaveLength(canonNames().length + 2);
  });

  describe('змінений уже накочений 0005', () => {
    const tampered = () => {
      canon.write(
        '0005_mail_outbox.sql',
        `${readFileSync(join(canon.dir, '0005_mail_outbox.sql'), 'utf8')}\n-- правка після накату\n`,
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
        '0005_mail_outbox.sql',
      ]);
      expect(await journalOf(dbUrl)).toEqual(journalBefore);
      expect(await counts()).toEqual(snapshot);
    });

    it('runStart: код 1, execve не викликано — контейнер не стартує', async () => {
      const storeDir = mkdtempSync(join(tmpdir(), 'simplycms-upgrade-store-'));
      try {
        const { cpSync, mkdirSync } = await import('node:fs');
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
        expect(logs.join('\n')).toContain('0005_mail_outbox.sql');
        expect(await counts()).toEqual(snapshot);
      } finally {
        rmSync(storeDir, { recursive: true, force: true });
      }
    });
  });
});
