// Advisory-лок накату (К3-Е8, Review Focus п.5): дві репліки, що стартують
// разом, серіалізуються. Детерміновано, без годинника: окреме з'єднання
// тримає лок, а доказом «накат чекає САМЕ на наш лок, а не просто повільний»
// є рядок `pg_locks` із `granted = false` на ключі `MIGRATION_LOCK_KEY`.
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMigrations, MIGRATION_LOCK_KEY } from 'simplycms/migrate';
import { resolveHarness } from '../up.mjs';
import {
  CANON_DIR,
  canonNames,
  exists,
  freshDb,
  journalOf,
  numberOf,
} from './fixtures/migrate';

/** Скільки з'єднань цієї БД чекають на лок накату (64-бітний ключ = classid:objid). */
const WAITING = `select count(*)::int as n from pg_locks
  where locktype = 'advisory' and granted = false and objsubid = 1
    and database = (select oid from pg_database where datname = current_database())
    and ((classid::bigint << 32) | objid::bigint) = ${MIGRATION_LOCK_KEY.toString()}`;

const POLL_LIMIT_MS = 5_000;

describe('applyMigrations: advisory-лок', () => {
  let harness: { url: string; teardown: () => Promise<void> };

  beforeAll(async () => {
    harness = await resolveHarness();
  }, 60_000);

  afterAll(async () => {
    await harness?.teardown();
  });

  it('чекає на чужий лок і докочує після release', async () => {
    const db = await freshDb(harness.url);
    const holder = new pg.Client({ connectionString: db.url });
    await holder.connect();
    let run: Promise<unknown> | undefined;
    try {
      await holder.query('select pg_advisory_lock($1::bigint)', [
        MIGRATION_LOCK_KEY.toString(),
      ]);
      run = applyMigrations({ connectionString: db.url, dir: CANON_DIR });
      // Відмову накату тут не ловимо одразу — її покаже `await run` нижче.
      run.catch(() => {});

      const deadline = Date.now() + POLL_LIMIT_MS;
      let waiting = 0;
      while (waiting === 0) {
        if (Date.now() > deadline)
          throw new Error('накат не став у чергу на лок за 5 с');
        waiting = await numberOf(db.url, WAITING);
      }
      expect(waiting).toBe(1);
      // Поки лок чужий, накат не зробив нічого — навіть журналу немає.
      expect(await exists(db.url, 'public.simplycms_migrations')).toBe(false);

      await holder.query('select pg_advisory_unlock($1::bigint)', [
        MIGRATION_LOCK_KEY.toString(),
      ]);
      await run;
      expect(await journalOf(db.url)).toHaveLength(canonNames().length);
    } finally {
      await holder.end();
      await run?.catch(() => {});
      await db.drop();
    }
  }, 120_000);
});
