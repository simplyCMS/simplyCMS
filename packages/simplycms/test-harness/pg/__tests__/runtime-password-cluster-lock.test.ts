// Фінальне рев'ю М1, раунд 4 (R3-1, R3-5): два «прогони» харнеса на одному кластері через РІЗНІ
// БД пишуть пароль `app_runtime`. Прогін А тримає незакомічений `alter role` під замком кластера,
// прогін Б синкає пароль накатом. Без серіалізації Б стає на рядок ролі й після коміту А падає
// `tuple concurrently updated` (XX000) — так відтворено флейк `start-migrate` у рев'ю. Із замком
// Б чекає на сам замок (advisory), а не на рядок, і пише вже після коміту А.
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMigrations } from 'simplycms/migrate';
import { queryRows } from '../apply.mjs';
import {
  holdClusterLock,
  RUNTIME_PASSWORD_LOCK,
  withClusterLock,
} from '../cluster-lock.mjs';
import { resolveHarness } from '../up.mjs';
import { CANON_DIR, freshDb } from './fixtures/migrate';
import { poll } from './fixtures/poll';

const APP = 'simplycms-rpw-run-b';

/** URL з `application_name`: за ним бекенди прогону Б видно в `pg_stat_activity`. */
const tagged = (url: string, user?: string, password?: string) => {
  const u = new URL(url);
  u.searchParams.set('application_name', APP);
  if (user) u.username = user;
  if (password) u.password = password;
  return u.toString();
};

describe('пароль app_runtime: прогони на одному кластері серіалізуються замком кластера', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  let dbA: Awaited<ReturnType<typeof freshDb>>;
  let dbB: Awaited<ReturnType<typeof freshDb>>;

  beforeAll(async () => {
    harness = await resolveHarness();
    dbA = await freshDb(harness.url);
    dbB = await freshDb(harness.url);
  }, 120_000);

  afterAll(async () => {
    await dbA?.drop();
    await dbB?.drop();
    await harness?.teardown();
  });

  it('Б через іншу БД чекає на замок, а не на рядок ролі, і пише після коміту А — без XX000', async () => {
    const lockA = await holdClusterLock(dbA.url, RUNTIME_PASSWORD_LOCK);
    const a = new pg.Client({ connectionString: dbA.url });
    let saved: string | null | undefined;
    let b: Promise<unknown> | undefined;
    try {
      saved = (
        (await queryRows(
          harness.url,
          `select rolpassword from pg_authid where rolname = 'app_runtime'`,
        )) as { rolpassword: string | null }[]
      )[0]!.rolpassword;
      await a.connect();
      await a.query('begin');
      await a.query(`alter role app_runtime password 'run-a-pass'`);

      b = withClusterLock(tagged(dbB.url), RUNTIME_PASSWORD_LOCK, () =>
        applyMigrations({
          connectionString: tagged(dbB.url),
          dir: CANON_DIR,
          runtimeUrl: tagged(dbB.url, 'app_runtime', 'run-b-pass'),
        }),
      );
      b.catch(() => undefined);
      // Б мусить реально стати в чергу (спостережуваний стан Postgres, не пауза): без
      // серіалізації — за рядком ролі, і тоді коміт А нижче дає XX000.
      const waitedOn = await poll(
        'прогін Б став у чергу за замком',
        async () =>
          (
            (await queryRows(
              harness.url,
              `select wait_event from pg_stat_activity
                where application_name = $1 and wait_event_type = 'Lock'`,
              [APP],
            )) as { wait_event: string }[]
          )[0]?.wait_event,
        { deadlineMs: 60_000 },
      );
      await a.query('commit');
      await lockA.release();

      const report = (await b) as { runtimePasswordSynced: boolean };
      expect(report.runtimePasswordSynced).toBe(true);
      expect(waitedOn).toBe('advisory');
    } finally {
      await a.end().catch(() => {});
      await lockA.release().catch(() => {});
      await b?.catch(() => {});
      // Пароль ролі кластера — як до кейсу (під тим самим замком, що й інші письменники).
      if (saved !== undefined)
        await withClusterLock(harness.url, RUNTIME_PASSWORD_LOCK, () =>
          queryRows(
            harness.url,
            saved == null
              ? 'alter role app_runtime password null'
              : `alter role app_runtime password '${saved.replace(/'/g, "''")}'`,
          ),
        );
    }
  }, 120_000);
});
