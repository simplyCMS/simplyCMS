// Гейт множини функцій і тригерів канону (Е6г-20).
//
// 🔴 Ручний SQL живе лише в ручних файлах канону (`0000_prelude`,
// `0004_functions`). Цей гейт робить межу вимірюваною: після накату канону на
// чисту БД функції схем `public`/`app` (без належних розширенням) і
// користувацькі тригери дорівнюють явному allowlist. Нова функція чи тригер
// без запису тут червонить `test:schema` — як і прихований SECURITY DEFINER.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
} from '../apply.mjs';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');

/** Функції — `схема.імʼя`, тригери — голе імʼя. */
const ALLOWLIST = [
  'app.current_user_id',
  'public.refuse_banned_session',
  'sessions_refuse_banned',
];

/** Усе користувацьке: функції (крім розширень) і нетехнічні тригери. */
const surface = async (url: string): Promise<string[]> => {
  const fns = await queryRows(
    url,
    `select n.nspname || '.' || p.proname as name
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app')
        and not exists (
          select 1 from pg_depend d
           where d.classid = 'pg_proc'::regclass
             and d.objid = p.oid and d.deptype = 'e')`,
  );
  const triggers = await queryRows(
    url,
    'select tgname as name from pg_trigger where not tgisinternal',
  );
  return [...fns, ...triggers].map((r) => String(r.name)).sort();
};

describe('канон міграцій: множина функцій і тригерів', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_fn_allowlist');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(
      dbUrl,
      readdirSync(CANON_DIR)
        .filter((n) => n.endsWith('.sql'))
        .sort()
        .map((n) => join(CANON_DIR, n)),
    );
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('після накату канону рівно allowlist', async () => {
    expect(await surface(dbUrl)).toEqual([...ALLOWLIST].sort());
  });

  it('гейт бачить зайву функцію (він не сліпий)', async () => {
    await queryRows(
      dbUrl,
      'create function public.rogue() returns int language sql as $$ select 1 $$',
    );
    expect(await surface(dbUrl)).toContain('public.rogue');
  });
});
