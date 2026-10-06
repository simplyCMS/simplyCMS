// БД, сховище й сід харнес-тестів системних налаштувань адмінки (К3-Е6б, Task 3):
// канон → app_runtime → afterAll із closeDbPool() ПЕРШИМ; `MEDIA_ROOT` — власна
// tmp-тека файла, бо операції адмінки беруть дефолтний драйвер сховища.
import { readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, vi } from 'vitest';
import { AuthzError, requireGrant, resolveGrant } from 'simplycms/auth';
import type { StoreProfile } from 'simplycms/contracts/store-profile';
import { closeDbPool } from 'simplycms/db';
import { localFsDriver, mediaKey } from 'simplycms/storage';
import { resolveHarness } from '../../up.mjs';
import * as H from '../../apply.mjs';

const MIGRATIONS = join(import.meta.dirname, '../../../../migrations');

/** Реєструє хуки БД і сховища; `url()` — привілейоване підключення. */
export function useSystemAdminDb(prefix: string) {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = H.randomDbName(prefix);
  let dbUrl = '';
  let root = '';
  beforeAll(async () => {
    harness = await resolveHarness();
    await H.createTempDatabase(harness.url, dbName);
    dbUrl = H.withDbName(harness.url, dbName);
    await H.applySqlFiles(
      dbUrl,
      readdirSync(MIGRATIONS)
        .filter((n) => n.endsWith('.sql'))
        .sort()
        .map((n) => join(MIGRATIONS, n)),
    );
    process.env.DATABASE_URL = H.withUser(dbUrl, 'app_runtime');
    root = await mkdtemp(join(tmpdir(), 'simplycms-admin-system-'));
    process.env.MEDIA_ROOT = root;
  }, 120_000);
  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    delete process.env.MEDIA_ROOT;
    if (root) await rm(root, { recursive: true, force: true });
    if (dbUrl) await H.dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });
  return { url: () => dbUrl, root: () => root };
}

export const rows = (url: string, sql: string, p: unknown[] = []) =>
  H.queryRows(url, sql, p) as Promise<Record<string, unknown>[]>;

/** Матчер доменної відмови правила стану (409, К3-13). */
export const stateConflict = (constraint: string) => ({
  name: 'AdminConflictError',
  kind: 'state',
  constraint,
});

/** Валідний профіль; `over` перекриває поля верхнього рівня. */
export const profile = (over: Partial<StoreProfile> = {}): StoreProfile => ({
  name: 'Сонячна крамниця',
  homeTitle: 'Панелі й інвертори',
  description: 'Усе для сонячної станції',
  contacts: {
    phone: '+380441234567',
    email: 'shop@example.com',
    address: 'Київ',
    hours: 'Пн–Пт 9–18',
  },
  logo: null,
  socials: [{ network: 'instagram', url: 'https://instagram.com/shop' }],
  ...over,
});

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
]);

/** Файл і рядок `media` повз операції (це сід): повертає референс. */
export async function seedMedia(
  url: string,
  root: string,
  entityType = 'store_logo',
): Promise<string> {
  const ref = mediaKey('image/png');
  await rows(
    url,
    `insert into public.media (id, entity_type, storage_key, size_bytes, mime_type)
     values ($1, $2, $3, $4, 'image/png')`,
    [crypto.randomUUID(), entityType, ref, PNG.byteLength],
  );
  await localFsDriver(root).put(ref, PNG);
  return ref;
}

/** Чи живі рядок `media` і файл за референсом — обидва факти окремо. */
export async function mediaState(url: string, root: string, ref: string) {
  const row = await rows(
    url,
    'select 1 from public.media where storage_key = $1',
    [ref],
  );
  const file = await localFsDriver(root).open(ref);
  return { row: row.length === 1, file: file !== null };
}

/** Сире значення рядка `store_profile` (або `null`, якщо рядка немає). */
export async function profileValue(url: string): Promise<unknown> {
  const [row] = await rows(
    url,
    `select value from public.system_settings where key = 'store_profile'`,
  );
  return row ? row.value : null;
}

/**
 * Чекає, доки в черзі advisory-локів поточної БД стоїть рівно `n` транзакцій.
 * Черга Postgres — FIFO: так тест задає порядок, у якому операції отримають лок.
 */
export async function untilAdvisoryWaiters(url: string, n: number) {
  const waiting = async () =>
    Number(
      (
        await rows(
          url,
          `select count(*)::int as c from pg_locks
            where locktype = 'advisory' and not granted
              and database = (select oid from pg_database where datname = current_database())`,
        )
      )[0]!.c,
    );
  for (let i = 0; i < 200 && (await waiting()) < n; i++)
    await new Promise((r) => setTimeout(r, 25));
  expect(await waiting()).toBe(n);
}

/** Наступний `requireGrant` — покупець: реальна матриця вирішує відмову. */
export function asCustomer(): void {
  vi.mocked(requireGrant).mockImplementationOnce(async (operation) => {
    const subject = { userId: null, roles: ['user'] as const };
    const scope = resolveGrant(subject, operation);
    if (!scope) throw new AuthzError(operation);
    return { subject, scope };
  });
}
