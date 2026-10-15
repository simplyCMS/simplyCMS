#!/usr/bin/env node

/**
 * Підняти демо-БД однією командою: канон `packages/simplycms/migrations/`
 * + `demo/demo-seed.sql` на СВІЖІЙ named-БД того самого
 * кластера — щоб магазин було ВИДНО (непорожній каталог), а не доводити
 * це порожнім чистим сідом (рішення B13, `0003_seed.sql`).
 *
 * «Одна команда» = гарантований чистий старт: БД дропається (якщо існує) і
 * створюється заново, а не докочується поверх невідомого стану.
 *
 * Канон котить `applyMigrations` із `simplycms/migrate` — та сама реалізація
 * накату з журналом, що й прод і харнес (Е8-Р2): демо-база має журнал, тож
 * `db:apply`/`status` над нею бачать те саме, що над справжнім магазином.
 * Демо-сід — не міграція: він котиться поза журналом, як і раніше.
 *
 * Використання:
 *   pnpm db:demo                                   # PG_HARNESS_URL, simplycms_demo
 *   pnpm db:demo -- --url postgresql://... --name my_demo
 *
 * Аргументи:
 *   --url   адміністративний рядок підключення (кластер; конкретна БД у
 *           шляху не важить — потрібна лише для CREATE/DROP DATABASE).
 *           За замовчуванням — PG_HARNESS_URL.
 *   --name  імʼя цільової БД. За замовчуванням — simplycms_demo.
 *   --comment  необовʼязкова позначка `COMMENT ON DATABASE`. Ставиться в
 *           тому ж кроці одразу після CREATE, ДО міграцій: обрив накату не
 *           лишає базу без позначки (С-16, `scripts/showcase/showcase-db.mts`
 *           за нею вирішує, чи можна базу перестворити). Без прапорця
 *           поведінка й вивід — як були.
 *
 * Тестовий шов: env `DEMO_DB_MIGRATIONS_DIR` підміняє теку канону (разом із
 * `demo/demo-seed.sql` у ній). Потрібен лише гейту `showcase-db-guard`, щоб
 * довести «міграція впала → позначка вже стоїть»; без env — канон пакета.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { tsImport } from 'tsx/esm/api';
import { loadHarnessEnv } from './harness-env.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
loadHarnessEnv(ROOT); // pnpm harness:up; явна змінна важливіша
const MIGRATIONS_DIR =
  process.env.DEMO_DB_MIGRATIONS_DIR ??
  join(ROOT, 'packages/simplycms/migrations');
const DEMO_FILE = join(MIGRATIONS_DIR, 'demo/demo-seed.sql');

/** `--url`/`--name`/`--comment` з argv (`node scripts/demo-db.mjs -- --name foo`). */
function parseArgs(argv) {
  const args = { url: process.env.PG_HARNESS_URL, name: 'simplycms_demo' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--url') args.url = argv[(i += 1)];
    else if (argv[i] === '--name') args.name = argv[(i += 1)];
    else if (argv[i] === '--comment') args.comment = argv[(i += 1)];
  }
  return args;
}

/** Той самий кластер, інша БД у шляху підключення. */
function withDbName(connectionString, dbName) {
  const url = new URL(connectionString);
  url.pathname = `/${dbName}`;
  return url.toString();
}

/**
 * Канон — через `applyMigrations`. Модуль ядра — TypeScript, а скрипт
 * запускають чистим `node` (`pnpm db:demo`, `live-smoke`, дочірній процес
 * `db:showcase`), тож ядро вантажиться через `tsImport` — лише цей модуль, без
 * глобальної реєстрації завантажувача.
 */
async function applyCanon(dbUrl) {
  const { applyMigrations } = await tsImport(
    '../packages/simplycms/src/migrate/index.ts',
    import.meta.url,
  );
  await applyMigrations({
    connectionString: dbUrl,
    dir: MIGRATIONS_DIR,
    log: (line) => console.log(`[demo-db] ${line}`),
  });
}

/**
 * Пересоздати БД `name` на кластері `adminUrl` — гарантований чистий старт.
 * `comment` (якщо задано) ставиться тим самим зʼєднанням одразу після CREATE.
 */
async function recreateDatabase(adminUrl, name, comment) {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(
      `select pg_terminate_backend(pid) from pg_stat_activity
         where datname = $1 and pid <> pg_backend_pid()`,
      [name],
    );
    await client.query(`drop database if exists "${name}"`);
    await client.query(`create database "${name}"`);
    // COMMENT не приймає параметрів — літерал екранує сам драйвер.
    if (comment !== undefined) {
      await client.query(
        `comment on database "${name}" is ${client.escapeLiteral(comment)}`,
      );
    }
  } finally {
    await client.end();
  }
}

/** Не-міграційний SQL (демо-сід) — по черзі в одному з'єднанні, поза журналом. */
async function applyFiles(dbUrl, files) {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    for (const file of files) {
      try {
        await client.query(readFileSync(file, 'utf8'));
      } catch (err) {
        throw new Error(`Накат ${file} впав: ${err.message}`, { cause: err });
      }
    }
  } finally {
    await client.end();
  }
}

/** Підсумок для екрана: таблиці, секції, товари, ціни, банери. */
async function summarize(dbUrl) {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const count = async (sql) => (await client.query(sql)).rows[0].n;
    return {
      tables: await count(
        `select count(*)::int as n from information_schema.tables
           where table_schema = 'public' and table_type = 'BASE TABLE'`,
      ),
      sections: await count('select count(*)::int as n from public.sections'),
      products: await count('select count(*)::int as n from public.products'),
      prices: await count(
        'select count(*)::int as n from public.product_prices',
      ),
      banners: await count('select count(*)::int as n from public.banners'),
    };
  } finally {
    await client.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    console.error(
      '❌ Немає підключення: задай --url або PG_HARNESS_URL.\n' +
        '   Напр.: PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55432/postgres pnpm db:demo',
    );
    process.exit(1);
  }
  if (!existsSync(DEMO_FILE)) {
    console.error(`❌ Не знайдено ${DEMO_FILE}`);
    process.exit(1);
  }

  console.log(`[demo-db] БД «${args.name}» — пересоздання…`);
  await recreateDatabase(args.url, args.name, args.comment);

  const dbUrl = withDbName(args.url, args.name);
  console.log(
    '[demo-db] накат канону (simplycms/migrate) + demo/demo-seed.sql…',
  );
  await applyCanon(dbUrl);
  await applyFiles(dbUrl, [DEMO_FILE]);

  const stats = await summarize(dbUrl);
  console.log('\n[demo-db] готово:');
  console.log(`  таблиць у public: ${stats.tables}`);
  console.log(`  секцій:           ${stats.sections}`);
  console.log(`  товарів:          ${stats.products}`);
  console.log(`  цін:              ${stats.prices}`);
  console.log(`  банерів:          ${stats.banners}`);
  console.log('\nDATABASE_URL для .env.local:');
  console.log(`  DATABASE_URL=${dbUrl}`);
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
