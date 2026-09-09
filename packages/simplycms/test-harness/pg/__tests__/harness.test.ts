// Смоук-тест PG-харнеса (Task 1, план В2-К1а): кластер доступний,
// `select version()` повертає щось схоже на Postgres, тимчасова БД
// створюється й дропається без залишків. Це фундамент для Tasks 3-5 —
// якщо цей тест червоний, увесь `test:schema` не має сенсу дебажити далі.
//
// 🔴 Говоримо з кластером лише через `apply.mjs` (queryRows/canConnect), не
// через прямий `new pg.Client()` — `pg` без `@types/pg` валить `tsc` у
// `.ts`-файлі (див. коментар у apply.mjs).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveHarness } from '../up.mjs';
import {
  canConnect,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  withDbName,
} from '../apply.mjs';

describe('pg harness (up.mjs + apply.mjs)', () => {
  let harness: { url: string; teardown: () => Promise<void> };

  beforeAll(async () => {
    harness = await resolveHarness();
  }, 60_000);

  afterAll(async () => {
    await harness?.teardown();
  });

  it('кластер доступний і віддає версію Postgres', async () => {
    const rows = await queryRows(harness.url, 'select version()');
    expect(rows[0].version).toMatch(/PostgreSQL/);
  });

  it('створює і дропає тимчасову БД', async () => {
    const dbName = `simplycms_harness_smoke_${Date.now()}`;
    await createTempDatabase(harness.url, dbName);

    const dbUrl = withDbName(harness.url, dbName);
    const rows = await queryRows(dbUrl, 'select current_database()');
    expect(rows[0].current_database).toBe(dbName);

    await dropTempDatabase(harness.url, dbName);

    // Після дропу підключення до тієї самої БД мусить впасти.
    expect(await canConnect(dbUrl)).toBe(false);
  });
});
