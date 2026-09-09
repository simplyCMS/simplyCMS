// Гейт `/api/health` проти живого Postgres (Task 4, план 0.4.1 severance).
//
// 🔴 Юніта тут бути не може за побудовою: ендпоінт доводить рівно одне —
// що застосунок ДІЙСНО дістає базу. Мок конекту перевіряв би мок. Тому обидва
// кейси — 200 на живому харнесі й 503 на завідомо битому `DATABASE_URL` —
// живуть у схемному контурі.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { Route } from '../../../routes/storefront/api/health';
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

/** Хост, якого гарантовано немає на лінії, — конект відбивається одразу. */
const BROKEN_URL = 'postgresql://app_runtime@127.0.0.1:1/simplycms_absent';

/** Роут віддає `handlers` як запис — тут це саме запис із одним GET. */
const handlers = Route.options.server?.handlers as unknown as {
  GET: () => Promise<Response>;
};

/** Виклик ендпоінта як його кличе Start: без аргументів, назовні — Response. */
const callHealth = async (): Promise<{
  status: number;
  body: Record<string, unknown>;
}> => {
  const response = await handlers.GET();
  return { status: response.status, body: await response.json() };
};

describe('/api/health: пінг Postgres', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_health');
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
    // Той самий користувач, під яким ходить магазин: під власником таблиць
    // `SET LOCAL ROLE` не міряється взагалі.
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('БД доступна → 200 і checks.database.ok', async () => {
    const { status, body } = await callHealth();

    expect(status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.checks).toEqual({ database: { ok: true, error: null } });
  });

  it('БД недоступна → 503, і назовні жодних деталей зʼєднання', async () => {
    // 🔴 Без гасіння пулу негативний кейс говорив би зі СТАРОЮ базою:
    // `getDbPool` — лінивий синглтон, і підміна `DATABASE_URL` посеред життя
    // процесу на вже створений пул не діє. Тест був би зеленим намарно.
    await closeDbPool();
    process.env.DATABASE_URL = BROKEN_URL;
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const { status, body } = await callHealth();

      expect(status).toBe(503);
      expect(body.status).toBe('degraded');
      expect(body.checks).toEqual({
        database: { ok: false, error: 'database unavailable' },
      });
      // Health — публічний неавтентифікований ендпоінт: hostname, порт і роль
      // з рядка підключення назовні не їдуть. Повна причина — лише в лог.
      const payload = JSON.stringify(body);
      expect(payload).not.toContain('127.0.0.1');
      expect(payload).not.toContain('app_runtime');
      expect(logged).toHaveBeenCalled();
    } finally {
      logged.mockRestore();
      await closeDbPool();
      process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
    }
  });
});
