// Накат канону міграцій на чисту БД (Task 3, план В2-К1а).
//
// 🔴 Це доказ рішення B13, а не смоук. Стара історія з 33 файлів котилася на
// чистий Postgres ЛИШЕ через рукотворний шим `auth.*`/`storage.*`. Тут шима
// немає взагалі — і саме тому тест зелений: у baseline v2 схем стороннього
// сервісу автентифікації й сховища не існує як класу. Поява такої залежності знову зробить
// цей файл червоним.
//
// Другий сенс — довести ідемпотентність: `0000_prelude`, `0003_seed` і `0004_functions`
// котяться повторно (докат канону в магазині, що вже стартував), тому
// прогін «двічі поспіль» тут обовʼязковий, а не косметичний.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
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
import { withActor } from '../actors.mjs';

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

  it('канон складається рівно з пʼяти упорядкованих файлів', () => {
    expect(canonFiles().map((p) => p.split('/').pop())).toEqual([
      '0000_prelude.sql',
      '0001_init.sql',
      '0002_grants.sql',
      '0003_seed.sql',
      '0004_functions.sql',
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
    // Точне число, а не нижня межа: `>=` пропустив би і зайву таблицю, і
    // забуту в міграції `drop`. Нова таблиця — свідома правка цього числа.
    // 45 → 44: Е6б прибрала мертву `plugin_events`.
    // 44 → 42: Е6г прибрала `services` і `service_requests`.
    // 42 → 43: Е6д додала службовий outbox `media_erasures` (Е6д-20).
    expect(tables.length).toBe(43);
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

  it('колонки order_items.service_id немає (Е6г зняла «Послуги»)', async () => {
    const rows = await queryRows(
      dbUrl,
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'order_items'
          and column_name = 'service_id'`,
    );
    expect(rows).toEqual([]);
  });

  it('RLS-ядро: політики лише на user-scoped таблицях, у initplan-формі', async () => {
    const rows = await queryRows(
      dbUrl,
      `select tablename, policyname, qual, with_check from pg_policies
        where schemaname = 'public'`,
    );
    // 24 → 25: службова `media_erasures_admin_all` (лише app_admin, Е6д-20).
    expect(rows.length).toBe(25);
    const tables = [
      ...new Set(rows.map((r: { tablename: string }) => r.tablename)),
    ].sort();
    expect(tables).toEqual([
      'comparisons',
      'media_erasures',
      'order_items',
      'orders',
      'product_reviews',
      'profiles',
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
    // (докат канону в магазині, що вже стартував); `0004_functions` — `CREATE OR
    // REPLACE`. Генерат `0001_init`
    // ідемпотентним НЕ є і бути не мусить: DDL-міграція котиться раз.
    await applySqlFiles(
      dbUrl,
      canonFiles().filter((p) => /000[034]_/.test(p)),
    );
    expect(await counts()).toEqual({ statuses: 6, themes: 1, settings: 2 });
  }, 120_000);

  // Е6г-14: бан тримає БД — тригер на sessions без SECURITY DEFINER.
  it('тригер sessions_refuse_banned стоїть на sessions', async () => {
    const rows = await queryRows(
      dbUrl,
      `select t.tgname, c.relname, p.prosecdef
         from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         join pg_proc p on p.oid = t.tgfoid
        where t.tgname = 'sessions_refuse_banned' and not t.tgisinternal`,
    );
    expect(rows).toEqual([
      {
        tgname: 'sessions_refuse_banned',
        relname: 'sessions',
        prosecdef: false,
      },
    ]);
  });

  // Е6б-5: профіль магазину замість мертвого `active_theme`; `plugin_events`
  // і `plugins.migrations_applied` ніхто не писав — прибрано з baseline.
  it('сід профілю на місці, мертве зі схеми прибрано', async () => {
    const profile = await queryRows(
      dbUrl,
      "select value from public.system_settings where key = 'store_profile'",
    );
    expect(profile[0]?.value).toEqual({
      name: 'Мій магазин',
      homeTitle: null,
      description: null,
      contacts: { phone: null, email: null, address: null, hours: null },
      logo: null,
      socials: [],
    });
    expect(
      await queryRows(
        dbUrl,
        "select key from public.system_settings where key = 'active_theme'",
      ),
    ).toHaveLength(0);
    const gone = await queryRows(
      dbUrl,
      `select to_regclass('public.plugin_events') as t,
        (select count(*) from information_schema.columns
          where table_name = 'plugins' and column_name = 'migrations_applied')::int as c`,
    );
    expect(gone[0]?.t).toBeNull();
    expect(Number(gone[0]?.c)).toBe(0);
  }, 120_000);

  // Е6д-8: домен статусу й рейтингу тримає БД. `app_admin` обходить RLS,
  // тож відмову дає саме CHECK (23514), а не політика чи грант.
  it('product_reviews: CHECK статусу й рейтингу існують і спрацьовують', async () => {
    const names = await queryRows(
      dbUrl,
      `select conname from pg_constraint
        where conrelid = 'public.product_reviews'::regclass and contype = 'c'
        order by conname`,
    );
    expect(names.map((row) => row.conname)).toEqual([
      'product_reviews_rating_check',
      'product_reviews_status_check',
    ]);
    const user = '55555555-5555-4555-8555-555555555555';
    const product = '66666666-6666-4666-8666-666666666666';
    await queryRows(
      dbUrl,
      `insert into public.users (id, email, name) values ($1, 'rv@example.test', 'RV')`,
      [user],
    );
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name) values ($1, 'rv', 'RV')`,
      [product],
    );
    await queryRows(
      dbUrl,
      `insert into public.product_reviews (id, product_id, user_id, rating)
       values (gen_random_uuid(), $1, $2, 5)`,
      [product, user],
    );
    for (const change of ["status = 'spam'", 'rating = 0', 'rating = 6']) {
      await expect(
        withActor(dbUrl, { role: 'app_admin' }, [
          `update public.product_reviews set ${change}`,
        ]),
      ).rejects.toMatchObject({ code: '23514' });
    }
  }, 120_000);

  // Е8-Р3: борги схеми, внесені в baseline на місці перед заморожуванням.
  it('борги схеми Е8-Р3: CHECK, NOT NULL, індекси; keyset-індекс покупців бере планувальник', async () => {
    const checks = await queryRows(
      dbUrl,
      `select conname from pg_constraint
        where conname in ('users_email_lowercase', 'user_category_history_source_check')
        order by conname`,
    );
    expect(checks.map((row) => row.conname)).toEqual([
      'user_category_history_source_check',
      'users_email_lowercase',
    ]);
    const notNull = await queryRows(
      dbUrl,
      `select table_name, is_nullable from information_schema.columns
        where table_schema = 'public' and column_name = 'stock_status'
          and table_name in ('products', 'product_modifications')
        order by table_name`,
    );
    expect(notNull).toEqual([
      { table_name: 'product_modifications', is_nullable: 'NO' },
      { table_name: 'products', is_nullable: 'NO' },
    ]);
    const indexes = await queryRows(
      dbUrl,
      `select indexname from pg_indexes
        where indexname in ('orders_created_at_idx', 'users_created_ms_id_idx')
        order by indexname`,
    );
    expect(indexes.map((row) => row.indexname)).toEqual([
      'orders_created_at_idx',
      'users_created_ms_id_idx',
    ]);

    // Джерело історії — лише 'manual' | 'rule'.
    const user = '77777777-7777-4777-8777-777777777777';
    await queryRows(
      dbUrl,
      `insert into public.users (id, email, name) values ($1, 'src@example.test', 'S')`,
      [user],
    );
    for (const [source, ok] of [
      ['manual', true],
      ['rule', true],
      ['auto', false],
    ] as const) {
      const insert = queryRows(
        dbUrl,
        `insert into public.user_category_history (id, user_id, to_category_name, source)
         values (gen_random_uuid(), $1, 'X', $2)`,
        [user, source],
      );
      if (ok) await insert;
      else await expect(insert).rejects.toMatchObject({ code: '23514' });
    }

    // 🔴 Індекс keyset покупців корисний, лише коли вираз ЗБІГАЄТЬСЯ із
    // запитом списку (`admin-server/impl/customers/list.ts`). seqscan вимкнено,
    // щоб на порожній таблиці вирішувала саме придатність індексу.
    const client = new pg.Client({ connectionString: dbUrl });
    await client.connect();
    try {
      await client.query('set enable_seqscan = off');
      const plan = await client.query(
        `explain select u.id from public.users u
          order by date_trunc('milliseconds', u.created_at at time zone 'UTC') desc, u.id desc
          limit 51`,
      );
      expect(plan.rows.map((row) => row['QUERY PLAN']).join('\n')).toContain(
        'users_created_ms_id_idx',
      );
    } finally {
      await client.end();
    }
  }, 120_000);
});
