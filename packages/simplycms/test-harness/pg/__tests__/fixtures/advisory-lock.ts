// Хелпери детермінованого доказу advisory-локу адмін-операцій (винесено з
// admin-catalog-ops.test.ts, Е3; спільні з admin-catalog-dictionaries.test.ts,
// Е4-12). Доказ не покладається на випадкову перемогу гонки: окремий
// pg-клієнт бере ТОЙ САМИЙ advisory-lock, що й операція
// (`pg_advisory_xact_lock(hashtextextended(key, 0))`, `impl/catalog-lock.ts`),
// і тримає його у ВІДКРИТІЙ транзакції — виклик операції не сміє
// резолвитись, доки конкурент не відпустить лок.
import pg from 'pg';

/** Тримає pg_advisory_xact_lock(hashtextextended(key,0)) у ВІДКРИТІЙ
 *  транзакції окремого зʼєднання — імітує конкурентну адмін-операцію
 *  ДО того, як вона встигла зняти лок COMMIT-ом.
 *
 * 🔴 `release`/`cleanup` — ІДЕМПОТЕНТНА пара (прапорець `closed`):
 * `release` — штатний шлях (commit + end), `cleanup` — гард у
 * `finally` тесту. Якщо проміжний `expect` між `holdLock` і `release`
 * впаде, `release` НЕ встигне викликатись — без `finally` клієнт
 * лишився б підключеним із ВІДКРИТОЮ транзакцією і лок висів би аж до
 * завершення процесу vitest, б'ючи по НАСТУПНИХ тестах (той самий
 * `key` заблокований). `cleanup` у такому разі відкочує транзакцію
 * (лок знімається і на ROLLBACK, не лише на COMMIT) і закриває
 * зʼєднання; якщо `release` уже відпрацював — `cleanup` no-op. */
export const holdAdvisoryLock = async (dbUrl: string, key: string) => {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  await client.query('begin');
  await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [
    key,
  ]);
  let closed = false;
  return {
    release: async () => {
      if (closed) return;
      closed = true;
      await client.query('commit');
      await client.end();
    },
    cleanup: async () => {
      if (closed) return;
      closed = true;
      try {
        await client.query('rollback');
      } finally {
        await client.end();
      }
    },
  };
};

/** true — проміс НЕ зарезолвився за `ms` (лок тримає). */
export const stillPending = (promise: Promise<unknown>, ms: number) => {
  const TIMEOUT = Symbol('timeout');
  return Promise.race([
    promise.then(() => 'resolved' as const),
    new Promise((r) => setTimeout(r, ms, TIMEOUT)),
  ]).then((v) => v === TIMEOUT);
};
