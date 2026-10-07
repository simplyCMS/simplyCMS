// К3-Е6в, Task 6 (Е6в-24): `app_user` оновлює `profiles` лише колонковим
// грантом на виміряний список. `category_id` (визначає ціну) і
// `category_locked` (вмикає автоправила) змінює лише `app_admin`.
//
// Негатив — 42501 саме на цих двох колонках, а не «RLS відфільтрувала рядок»:
// рядок свій (USER_A), тож відмову дає грант. Позитив — КОЖНА колонка
// декларації (`COLUMN_GRANTS`) оновлюється під `app_user`, і справжній шлях
// вітрини (`updateProfile`) проходить: список не закороткий.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { updateProfile, withCustomerDb } from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';
import { withActor } from '../actors.mjs';
import { COLUMN_GRANTS } from './fixtures/grants';
import { SEED_STATEMENTS, USER_A } from './fixtures/rls-actors';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');
const AS_A = { userId: USER_A, role: 'app_user' };
const RETAIL = `(select id from public.user_categories where code = 'retail')`;

/** Значення для позитивного кейсу кожної колонки з декларації. */
const VALUES: Record<string, string> = {
  first_name: `'Оновлене'`,
  last_name: `'Прізвище'`,
  phone: `'+380000000077'`,
  avatar_url: `'avatars/e6v.webp'`,
  updated_at: 'now()',
};

describe('Е6в-24: колонковий UPDATE profiles для app_user', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_profile_columns');
  let dbUrl = '';
  let runtimeUrl = '';

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(
      dbUrl,
      readdirSync(CANON_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort()
        .map((name) => join(CANON_DIR, name)),
    );
    for (const statement of SEED_STATEMENTS) await queryRows(dbUrl, statement);
    runtimeUrl = withUser(dbUrl, 'app_runtime');
    process.env.DATABASE_URL = runtimeUrl;
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  const ownProfile = async () =>
    (
      (await queryRows(
        dbUrl,
        `select category_id, category_locked from public.profiles where user_id = $1`,
        [USER_A],
      )) as { category_id: string | null; category_locked: boolean }[]
    )[0];

  it.each([
    ['category_id', RETAIL],
    ['category_locked', 'true'],
  ])(
    'app_user: update profiles set %s → 42501, рядок незмінний',
    async (column, value) => {
      const before = await ownProfile();
      await expect(
        withActor(runtimeUrl, AS_A, [
          `update public.profiles set ${column} = ${value} where user_id = '${USER_A}'`,
        ]),
      ).rejects.toMatchObject({ code: '42501' });
      expect(await ownProfile()).toEqual(before);
    },
  );

  const declared = COLUMN_GRANTS.profiles!.app_user!.UPDATE!;

  it('декларація покрита значеннями тесту (нова колонка не пройде повз позитив)', () => {
    expect(Object.keys(VALUES).sort()).toEqual(declared);
  });

  it.each(declared)(
    'app_user: колонка %s оновлюється (свій рядок)',
    async (column) => {
      const rows = await withActor(runtimeUrl, AS_A, [
        `update public.profiles set ${column} = ${VALUES[column]}
        where user_id = '${USER_A}' returning id`,
      ]);
      expect(rows).toHaveLength(1);
    },
  );

  it('справжній шлях вітрини: updateProfile під withCustomerDb проходить', async () => {
    await withCustomerDb(USER_A, (db) =>
      updateProfile(db, USER_A, {
        firstName: 'Через',
        lastName: 'Вітрину',
        phone: null,
      }),
    );
    const [row] = (await queryRows(
      dbUrl,
      `select first_name, last_name, phone from public.profiles where user_id = $1`,
      [USER_A],
    )) as Record<string, unknown>[];
    expect(row).toEqual({
      first_name: 'Через',
      last_name: 'Вітрину',
      phone: null,
    });
  });
});
