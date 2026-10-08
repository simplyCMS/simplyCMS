// Захист бази команди `db:showcase` (С-16а): перестворюється лише база з
// позначкою, чужа — ніколи, а позначка стоїть ще ДО міграцій.
//
// 🔴 Тест не торкається справжньої `simplycms_showcase`: кожен кейс бере
// унікальне `randomDbName`, а після виклику асертить, що OID і позначка
// бази команди на стенді ті самі, що до тесту (або її як не було, так і немає).
import pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  prepareShowcaseDb,
  SHOWCASE_DB_COMMENT,
  SHOWCASE_DB_NAME,
  ShowcaseForeignDbError,
  withShowcaseLock,
} from '../../../../../scripts/showcase/showcase-db.mts';
import {
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
} from '../apply.mjs';
import { resolveHarness } from '../up.mjs';
import { stillPending } from './fixtures/advisory-lock';
import {
  brokenMigrationsDir,
  dbState,
  holdShowcaseLock,
  numberIn,
  type DbState,
} from './fixtures/showcase-db';

describe('prepareShowcaseDb: позначка бази команди', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  let admin: pg.Client;
  let commandDbBefore: DbState;
  const created: string[] = [];

  const stateOf = (name: string) => dbState(harness.url, name);
  const freshName = (): string => {
    const name = randomDbName('showcase_guard');
    expect(name).not.toBe(SHOWCASE_DB_NAME);
    created.push(name);
    return name;
  };
  const prepare = (name: string) =>
    withShowcaseLock(admin, () =>
      prepareShowcaseDb({ client: admin, url: harness.url }, name),
    );
  const count = (name: string, sql: string) => numberIn(harness.url, name, sql);

  beforeAll(async () => {
    harness = await resolveHarness();
    admin = new pg.Client({ connectionString: harness.url });
    await admin.connect();
    commandDbBefore = await stateOf(SHOWCASE_DB_NAME);
  }, 120_000);

  afterEach(async () => {
    expect(await stateOf(SHOWCASE_DB_NAME)).toEqual(commandDbBefore);
  });

  afterAll(async () => {
    await admin?.end();
    for (const name of created) await dropTempDatabase(harness.url, name);
    await harness?.teardown();
  }, 120_000);

  it('(1) база без позначки з даними → ShowcaseForeignDbError, база й дані цілі', async () => {
    const name = freshName();
    await admin.query(`create database "${name}"`);
    const own = withDbName(harness.url, name);
    await queryRows(own, 'create table mine (x int)');
    await queryRows(own, 'insert into mine values (42)');
    const before = await stateOf(name);
    await expect(prepare(name)).rejects.toBeInstanceOf(ShowcaseForeignDbError);
    expect(await stateOf(name)).toEqual(before);
    expect(await count(name, 'select x as n from mine')).toBe(42);
  });

  it('(2) база з позначкою і ручним користувачем → перестворена', async () => {
    const name = freshName();
    expect(await prepare(name)).toBe('created');
    const first = await stateOf(name);
    await queryRows(
      withDbName(harness.url, name),
      `insert into public.users (id, name, email, email_verified, created_at, updated_at)
       values (gen_random_uuid(), 'Власник', 'me@example.test', true, now(), now())`,
    );
    expect(await prepare(name)).toBe('recreated');
    const second = await stateOf(name);
    expect(second?.oid).not.toBe(first?.oid);
    expect(second?.comment).toBe(SHOWCASE_DB_COMMENT);
    expect(
      await count(name, 'select count(*)::int as n from public.users'),
    ).toBe(0);
  });

  it('(3) бази немає → створена, позначена й накочена з демо-сідом', async () => {
    const name = freshName();
    expect(await stateOf(name)).toBeNull();
    expect(await prepare(name)).toBe('created');
    expect((await stateOf(name))?.comment).toBe(SHOWCASE_DB_COMMENT);
    expect(
      await count(name, 'select count(*)::int as n from public.products'),
    ).toBeGreaterThan(0);
  });

  it('(4) міграція падає → база вже позначена, повтор її перестворює', async () => {
    const name = freshName();
    const broken = await brokenMigrationsDir();
    try {
      process.env.DEMO_DB_MIGRATIONS_DIR = broken.dir;
      await expect(prepare(name)).rejects.toThrow(/db:demo/);
    } finally {
      delete process.env.DEMO_DB_MIGRATIONS_DIR;
      await broken.cleanup();
    }
    expect((await stateOf(name))?.comment).toBe(SHOWCASE_DB_COMMENT);
    expect(await prepare(name)).toBe('recreated');
    expect(
      await count(name, 'select count(*)::int as n from public.products'),
    ).toBeGreaterThan(0);
  });

  it('другий запуск чекає, поки перший тримає лок команди', async () => {
    const name = freshName();
    const holder = await holdShowcaseLock(harness.url);
    try {
      const second = prepare(name);
      expect(await stillPending(second, 500)).toBe(true);
      expect(await stateOf(name)).toBeNull();
      await holder.release();
      expect(await second).toBe('created');
    } finally {
      await holder.cleanup();
    }
  });

  it('поза локом prepareShowcaseDb відмовляє', async () => {
    const name = freshName();
    await expect(
      prepareShowcaseDb({ client: admin, url: harness.url }, name),
    ).rejects.toThrow(/withShowcaseLock/);
    expect(await stateOf(name)).toBeNull();
  });
});
