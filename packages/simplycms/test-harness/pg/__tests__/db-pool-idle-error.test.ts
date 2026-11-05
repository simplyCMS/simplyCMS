// Обрив ПРОСТОГО зʼєднання пулу не повинен валити процес.
//
// 🔴 pg-pool переемітить помилку idle-клієнта як `pool.emit('error')`; без
// слухача EventEmitter кидає її необробленим винятком (57P01 при рестарті БД,
// закритті idle пулером чи failover). Поведінка справжня лише на живому
// Postgres, тому тест у pg-контурі; vitest видасть Unhandled Error, якщо
// слухача немає.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { closeDbPool } from 'simplycms/db';
import { withStorefrontDb } from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import {
  applyCanon,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';

async function backendPid(): Promise<number> {
  return withStorefrontDb(async (db) => {
    const res = await db.execute(sql`select pg_backend_pid() as pid`);
    return res.rows[0].pid as number;
  });
}

describe('пул: обрив простого зʼєднання', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_pool_idle');

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    const dbUrl = withDbName(harness.url, dbName);
    await applyCanon(dbUrl);
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    await dropTempDatabase(harness.url, dbName);
    await harness.teardown();
  });

  it('пул лишається живим: помилка йде в лог, наступний запит відкриває нове зʼєднання', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // Голий пул з simplycms/db не експортується (межа B5″), тож ходимо
      // легальним шляхом; після транзакції клієнт повертається в пул простим.
      const pid = await backendPid();

      await queryRows(harness.url, 'select pg_terminate_backend($1)', [pid]);

      // Слухач пулу лишає слід у лозі; без слухача тут був би Unhandled Error.
      await vi.waitFor(() => expect(log).toHaveBeenCalled(), {
        timeout: 5_000,
      });
      const error = log.mock.calls[0]?.[1] as { code?: string } | undefined;
      expect(error?.code).toBe('57P01');

      expect(await backendPid()).not.toBe(pid);
    } finally {
      log.mockRestore();
    }
  });
});
