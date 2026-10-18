// Флейк `start-migrate` (фінальне рев'ю М1, раунд 2): прелюдія безумовно писала ролі й членство
// в спільний каталог кластера, і паралельні накати на різні БД того самого кластера падали
// `tuple concurrently updated`. Тепер `alter role`/`grant` — лише за відмінності стану.
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveHarness } from '../up.mjs';
import * as H from '../apply.mjs';
import { waitForSettled } from './fixtures/lock-holders';

const PRELUDE = join(H.CANON_DIR, '0000_prelude.sql');

describe('прелюдія на спільному кластері: паралельні накати', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbs: string[] = [];
  const freshDb = async () => {
    const name = H.randomDbName('simplycms_prelude_conc');
    await H.createTempDatabase(harness.url, name);
    dbs.push(name);
    return H.withDbName(harness.url, name);
  };

  beforeAll(async () => {
    harness = await resolveHarness();
  });
  afterAll(async () => {
    for (const name of dbs) await H.dropTempDatabase(harness.url, name);
    await harness?.teardown();
  });

  it('повторний накат на підготовленому кластері не пише в рядок ролі: проходить повз незакомічений ALTER ROLE', async () => {
    const url = await freshDb();
    // T0 тримає незакомічену зміну рядка ролі (той самий стан, що канон): безумовний
    // `alter role` прелюдії став би на цей рядок і після коміту T0 впав би
    // `tuple concurrently updated`.
    const t0 = new pg.Client({ connectionString: harness.url });
    await t0.connect();
    try {
      await t0.query('begin');
      await t0.query(
        'alter role app_user nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole',
      );
      const prelude = H.applySqlFiles(url, [PRELUDE]);
      // Строго: накат мусить ЗАВЕРШИТИСЬ, поки T0 тримає рядок ролі.
      await waitForSettled('прелюдія завершилась повз T0', prelude);
      await prelude;
    } finally {
      await t0.query('rollback');
      await t0.end();
    }
  });

  it('прелюдія проходить повз сусіда, що тримає тотожний grant членства (замок групової ролі)', async () => {
    const url = await freshDb();
    // Тотожний `grant` нічого не пише, але тримає ShareUpdateExclusiveLock на `app_user` до
    // кінця транзакції; безумовний `grant` прелюдії став би на цей замок (фінальне рев'ю, N4).
    const t0 = new pg.Client({ connectionString: harness.url });
    await t0.connect();
    try {
      await t0.query('begin');
      await t0.query(
        'grant app_user to app_runtime with inherit false, set true',
      );
      // Передумова: T0 справді тримає замок ролі (інакше кейс нічого не доводить).
      const held = await t0.query(
        `select 1 from pg_locks l join pg_roles r on r.oid = l.objid
          where l.pid = pg_backend_pid() and l.locktype = 'object'
            and l.classid = 'pg_authid'::regclass and r.rolname = 'app_user'
            and l.mode = 'ShareUpdateExclusiveLock'`,
      );
      expect(held.rowCount).toBe(1);
      const prelude = H.applySqlFiles(url, [PRELUDE]);
      await waitForSettled('прелюдія завершилась повз замок ролі T0', prelude);
      await prelude;
    } finally {
      await t0.query('rollback');
      await t0.end();
    }
  });

  it('N паралельних накатів канону на одному кластері — усі ok', async () => {
    const urls = await Promise.all(Array.from({ length: 6 }, () => freshDb()));
    const results = await Promise.allSettled(urls.map((u) => H.applyCanon(u)));
    expect(results.map((r) => r.status)).toEqual(urls.map(() => 'fulfilled'));
  });
});
