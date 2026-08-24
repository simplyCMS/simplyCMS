// Резолв підключення до Postgres для гейта `test:schema` (Task 1, план
// В2-К1а). Два шляхи, у порядку пріоритету:
//
//   1. `PG_HARNESS_URL` заданий (CI service-контейнер `postgres:17` або
//      локальний кластер розробника) — перевіряємо конект і віддаємо як є.
//   2. Фолбек — ефемерний кластер `initdb`+`pg_ctl` (`./ephemeral-cluster.mjs`),
//      що сам себе гасить у `teardown()`.
//
// Логіку фолбеку винесено в окремий файл — інакше модуль перевищує ліміт
// 150 рядків (coding-style).
import pg from 'pg';
import { startEphemeralCluster } from './ephemeral-cluster.mjs';

async function assertReachable(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('select 1');
  } finally {
    await client.end();
  }
}

/**
 * Резолвить підключення до Postgres. Повертає `{ url, teardown }`.
 */
export async function resolveHarness() {
  const envUrl = process.env.PG_HARNESS_URL;
  if (envUrl) {
    try {
      await assertReachable(envUrl);
    } catch (err) {
      throw new Error(
        `PG_HARNESS_URL заданий (${envUrl}), але конект не вдався: ${err.message}`,
      );
    }
    return { url: envUrl, teardown: async () => {} };
  }
  return startEphemeralCluster();
}
