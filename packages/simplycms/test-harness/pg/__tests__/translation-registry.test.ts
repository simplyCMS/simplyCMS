// Реєстр `TRANSLATABLE` ↔ жива БД (М2, Д11 б–в). Реєстр — рядкові адреси, тож його
// розсинхрон із канонічною схемою не бачить жоден тип: нова перекладна таблиця
// без запису в реєстрі, обов'язкове поле без тригера джерела чи переклад із
// правами, що відрізняються від бази, — тихі дефекти. Тут вони червоні.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TRANSLATABLE, type TranslatableEntity } from 'simplycms/translations';
import { resolveHarness } from '../up.mjs';
import {
  applyCleanCanon,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
} from '../apply.mjs';

const ENTRIES: [string, TranslatableEntity][] = Object.entries(TRANSLATABLE);

describe('реєстр перекладів ↔ канонічна БД', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_trreg');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applyCleanCanon(dbUrl);
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  const triggerTables = async (): Promise<string[]> =>
    (
      await queryRows(
        dbUrl,
        `select tgrelid::regclass::text as rel
           from pg_trigger
          where tgname like '%\\_src\\_tr' and not tgisinternal
          order by 1`,
      )
    ).map((r) => r.rel as string);

  it('(а) кожна таблиця з тригером джерела є в реєстрі', async () => {
    const registered = new Set(ENTRIES.map(([, e]) => e.table));
    const orphans = (await triggerTables()).filter((t) => !registered.has(t));
    expect(orphans).toEqual([]);
  });

  it('(б) запис з обовʼязковим полем має тригер джерела', async () => {
    const withTrigger = new Set(await triggerTables());
    const missing = ENTRIES.filter(
      ([, e]) => e.required.length > 0 && !withTrigger.has(e.table),
    ).map(([key]) => key);
    expect(missing).toEqual([]);
  });

  it('(в) гранти таблиці перекладу = гранти її бази', async () => {
    const grantsOf = async (table: string) =>
      (
        await queryRows(
          dbUrl,
          `select grantee, privilege_type from information_schema.role_table_grants
            where table_schema = 'public' and table_name = $1
              and grantee in ('app_user', 'app_admin', 'app_runtime', 'PUBLIC')
            order by 1, 2`,
          [table],
        )
      ).map((r) => `${r.grantee}:${r.privilege_type}`);
    for (const [key, e] of ENTRIES) {
      const own = await grantsOf(e.table);
      expect(own.length, `${key}: гранти ${e.table}`).toBeGreaterThan(0);
      expect(own, `${key}: ${e.table} ↔ ${e.base}`).toEqual(
        await grantsOf(e.base),
      );
    }
  });
});
