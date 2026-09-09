#!/usr/bin/env node

/**
 * Підняти демо-БД однією командою: канон `packages/simplycms/migrations/`
 * (0000 → 0003) + `demo/demo-seed.sql` на СВІЖІЙ named-БД того самого
 * кластера — щоб магазин було ВИДНО (непорожній каталог), а не доводити
 * це порожнім чистим сідом (рішення B13, `0003_seed.sql`).
 *
 * «Одна команда» = гарантований чистий старт: БД дропається (якщо існує) і
 * створюється заново, а не докочується поверх невідомого стану. Сам SQL
 * канону + демо-сіду ідемпотентний (доказ — `test:schema`), тож повторний
 * накат на вже наповнену БД так само безпечний, якби колись знадобився.
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
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'packages/simplycms/migrations');
const DEMO_FILE = join(MIGRATIONS_DIR, 'demo/demo-seed.sql');

/** `--url`/`--name` з argv (`node scripts/demo-db.mjs -- --name foo`). */
function parseArgs(argv) {
  const args = { url: process.env.PG_HARNESS_URL, name: 'simplycms_demo' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--url') args.url = argv[(i += 1)];
    else if (argv[i] === '--name') args.name = argv[(i += 1)];
  }
  return args;
}

/** Той самий кластер, інша БД у шляху підключення. */
function withDbName(connectionString, dbName) {
  const url = new URL(connectionString);
  url.pathname = `/${dbName}`;
  return url.toString();
}

/** SQL-файли канону в порядку імен (порядок накату) + демо-сід останнім. */
function migrationFiles() {
  const canon = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(MIGRATIONS_DIR, name));
  return [...canon, DEMO_FILE];
}

/** Пересоздати БД `name` на кластері `adminUrl` — гарантований чистий старт. */
async function recreateDatabase(adminUrl, name) {
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
  } finally {
    await client.end();
  }
}

/** Накатити файли по черзі в одному з'єднанні (просте query-протокол). */
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
  await recreateDatabase(args.url, args.name);

  const dbUrl = withDbName(args.url, args.name);
  console.log('[demo-db] накат канону (0000→0003) + demo/demo-seed.sql…');
  await applyFiles(dbUrl, migrationFiles());

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
