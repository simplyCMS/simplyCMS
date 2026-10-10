// Хелпери гейта бази команди `db:showcase` (`showcase-db-guard.test.ts`).
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { withShowcaseLock } from '../../../../../../scripts/showcase/showcase-db.mts';
import { queryRows, withDbName } from '../../apply.mjs';

/** OID і позначка бази; `null` — бази немає. */
export type DbState = { oid: number; comment: string | null } | null;

export const dbState = async (
  adminUrl: string,
  name: string,
): Promise<DbState> => {
  const rows = (await queryRows(
    adminUrl,
    `select oid::int as oid, shobj_description(oid, 'pg_database') as comment
       from pg_database where datname = $1`,
    [name],
  )) as { oid: number; comment: string | null }[];
  return rows[0] ?? null;
};

/** Одне число (`… as n`) із бази `name`. */
export const numberIn = async (
  adminUrl: string,
  name: string,
  sql: string,
): Promise<number> =>
  ((await queryRows(withDbName(adminUrl, name), sql)) as { n: number }[])[0]!.n;

/**
 * Тека «канону» з єдиною зламаною міграцією для шва `DEMO_DB_MIGRATIONS_DIR`
 * (`demo-db.mjs`): доводить, що позначка стоїть ДО накату.
 */
export const brokenMigrationsDir = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'showcase-broken-'));
  await mkdir(join(dir, 'demo'));
  await writeFile(join(dir, '0000_broken.sql'), 'select * from no_such_table;');
  await writeFile(join(dir, 'demo/demo-seed.sql'), '');
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
};

/**
 * Окреме зʼєднання, що ВЖЕ тримає лок команди (повернення — після входу в
 * критичну секцію): так тест міряє серіалізацію, а не те, хто першим дійшов
 * до сервера. `cleanup` — ідемпотентний гард для `finally`.
 */
export const holdShowcaseLock = async (adminUrl: string) => {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let entered!: () => void;
  const inside = new Promise<void>((resolve) => (entered = resolve));
  const done = withShowcaseLock(client, () => {
    entered();
    return held;
  });
  await inside;
  let closed = false;
  return {
    release: async () => {
      release();
      await done;
    },
    cleanup: async () => {
      if (closed) return;
      closed = true;
      release();
      await done.catch(() => {});
      await client.end();
    },
  };
};
