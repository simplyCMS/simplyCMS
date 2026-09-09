// Накат канону міграцій на чисту БД (Task 3, план В2-К1а).
//
// 🔴 Це доказ рішення B13, а не смоук. Стара історія з 33 файлів котилася на
// чистий Postgres ЛИШЕ через рукотворний шим `auth.*`/`storage.*`. Тут шима
// немає взагалі — і саме тому тест зелений: у baseline v2 схеми GoTrue й
// Supabase Storage не існує як класу. Поява такої залежності знову зробить
// цей файл червоним.
//
// Другий сенс — довести ідемпотентність: `0000_prelude` і `0003_seed`
// котяться повторно (докат канону в магазині, що вже стартував), тому
// прогін «двічі поспіль» тут обовʼязковий, а не косметичний.
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

/** SQL-файли канону в порядку імен — він і є порядком накату. */
const canonFiles = (): string[] =>
  readdirSync(CANON_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(CANON_DIR, name));

describe('канон міграцій: накат на чисту БД', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_baseline');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, canonFiles());
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('канон складається рівно з чотирьох упорядкованих файлів', () => {
    expect(canonFiles().map((p) => p.split('/').pop())).toEqual([
      '0000_prelude.sql',
      '0001_init.sql',
      '0002_grants.sql',
      '0003_seed.sql',
    ]);
  });

  it('жоден файл канону не згадує auth.* чи storage.* (доказ B13)', async () => {
    const { readFileSync } = await import('node:fs');
    for (const file of canonFiles()) {
      const sql = readFileSync(file, 'utf8').replace(/--[^\n]*/g, '');
      expect(sql).not.toMatch(/\bauth\./);
      expect(sql).not.toMatch(/\bstorage\./);
    }
  });

  it('передумови накотились: схема app, читач GUC, три ролі', async () => {
    const fn = await queryRows(
      dbUrl,
      `select provolatile, prosecdef from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname = 'current_user_id'`,
    );
    // STABLE (`s`) і SECURITY INVOKER — інакше це знову SECDEF без гарда.
    expect(fn).toHaveLength(1);
    expect(fn[0].provolatile).toBe('s');
    expect(fn[0].prosecdef).toBe(false);

    const roles = await queryRows(
      dbUrl,
      `select rolname, rolcanlogin, rolbypassrls, rolinherit, rolsuper
         from pg_roles
        where rolname in ('app_runtime', 'app_user', 'app_admin')
        order by rolname`,
    );
    expect(roles.map((r: { rolname: string }) => r.rolname)).toEqual([
      'app_admin',
      'app_runtime',
      'app_user',
    ]);
    // 🔴 Жодна роль не BYPASSRLS і не суперкористувач; логінитись сміє лише
    // рантайм-роль; NOINHERIT на всіх — без нього членство віддавало б права
    // `app_user` ще ДО `SET ROLE`, і fail-closed зник би мовчки.
    for (const role of roles as {
      rolbypassrls: boolean;
      rolsuper: boolean;
      rolinherit: boolean;
    }[]) {
      expect(role.rolbypassrls).toBe(false);
      expect(role.rolsuper).toBe(false);
      expect(role.rolinherit).toBe(false);
    }
    expect(
      roles
        .filter((r: { rolcanlogin: boolean }) => r.rolcanlogin)
        .map((r: { rolname: string }) => r.rolname),
    ).toEqual(['app_runtime']);
  });

  it('схема на місці: доменні таблиці, таблиці BA, media', async () => {
    const rows = await queryRows(
      dbUrl,
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    const tables = rows.map((r: { table_name: string }) => r.table_name);
    expect(tables.length).toBeGreaterThanOrEqual(45);
    for (const expected of [
      'users',
      'sessions',
      'accounts',
      'verifications',
      'media',
      'orders',
      'profiles',
    ])
      expect(tables).toContain(expected);
    // Схем, крім public і app, baseline не створює.
    const schemas = await queryRows(
      dbUrl,
      `select nspname from pg_namespace
        where nspname not like 'pg\\_%' and nspname <> 'information_schema'
        order by nspname`,
    );
    expect(schemas.map((r: { nspname: string }) => r.nspname)).toEqual([
      'app',
      'public',
    ]);
  });

  it('RLS-ядро: політики лише на user-scoped таблицях, у initplan-формі', async () => {
    const rows = await queryRows(
      dbUrl,
      `select tablename, policyname, qual, with_check from pg_policies
        where schemaname = 'public'`,
    );
    expect(rows.length).toBe(27);
    const tables = [
      ...new Set(rows.map((r: { tablename: string }) => r.tablename)),
    ].sort();
    expect(tables).toEqual([
      'comparisons',
      'order_items',
      'orders',
      'product_reviews',
      'profiles',
      'service_requests',
      'user_addresses',
      'user_category_history',
      'user_recipients',
      'user_roles',
      'wishlists',
    ]);
    // 🔴 Голий виклик `app.current_user_id()` (без обгортки `select`)
    // переобчислюється на КОЖЕН рядок — саме той антипатерн, що знайшов
    // живий аудит (21/21 політики). Обгортка мусить бути скрізь.
    for (const row of rows as {
      qual: string | null;
      with_check: string | null;
    }[])
      for (const predicate of [row.qual, row.with_check])
        if (predicate?.includes('current_user_id'))
          expect(predicate).toMatch(/\(\s*SELECT\s+app\.current_user_id\(\)/i);
  });

  it('сід чистого магазину на місці й ідемпотентний', async () => {
    const counts = async () => ({
      statuses: (
        await queryRows(dbUrl, 'select code from public.order_statuses')
      ).length,
      themes: (
        await queryRows(dbUrl, 'select name from public.themes where is_active')
      ).length,
      settings: (
        await queryRows(dbUrl, 'select key from public.system_settings')
      ).length,
    });
    expect(await counts()).toEqual({ statuses: 6, themes: 1, settings: 2 });

    // 🔴 Ідемпотентні саме рукописні файли — `0000_prelude` (ролі кластерні:
    // друга БД того самого кластера бачить їх наявними) і `0003_seed`
    // (докат канону в магазині, що вже стартував). Генерат `0001_init`
    // ідемпотентним НЕ є і бути не мусить: DDL-міграція котиться раз.
    await applySqlFiles(
      dbUrl,
      canonFiles().filter((p) => /000[03]_/.test(p)),
    );
    expect(await counts()).toEqual({ statuses: 6, themes: 1, settings: 2 });
  }, 120_000);
});
