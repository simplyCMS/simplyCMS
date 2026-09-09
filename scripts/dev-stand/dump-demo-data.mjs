#!/usr/bin/env node
/**
 * Санітизований каталожний дамп живої БД → `scripts/dev-stand/seed-demo.sql`
 * (задача §2 блок C, план Р8).
 *
 * Тонкий шар: тут лише IO (`pg` + запис файлу). Що саме читається — константа
 * `table-specs.mjs`; як це стає SQL — чиста `generate-seed.mjs` під тестом.
 *
 * 🔴 Читання ЛИШЕ на select, жодних записів у джерело. Згенерований SQL —
 * gitignored: чужі каталожні дані не комітяться в OSS-репо.
 *
 * Юзаж: `DATABASE_URL=... node scripts/dev-stand/dump-demo-data.mjs`
 */

import { config as loadEnv } from 'dotenv';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { generateSeedSql } from './generate-seed.mjs';
import { TABLE_SPECS } from './table-specs.mjs';

const here = resolve(fileURLToPath(import.meta.url), '..');
const OUT_PATH = join(here, 'seed-demo.sql');

loadEnv({ path: resolve(here, '../../.env.local') });

const MISSING_URL_HELP = `[dev-stand] DATABASE_URL не заданий — дамп неможливий.

Де взяти рядок підключення:
  Supabase → Project Settings → Database → Connection string → Session pooler
  (саме SESSION pooler, не transaction: дамп тримає одне зʼєднання й читає
  кілька таблиць поспіль). Не забудь ?sslmode=require.

Куди покласти:
  .env.local у корені репо:  DATABASE_URL=postgresql://...:6543/postgres?sslmode=require
  або разово:                DATABASE_URL=... node scripts/dev-stand/dump-demo-data.mjs

Що буде далі:
  скрипт прочитає ЛИШЕ каталожні таблиці allowlist-у (scripts/dev-stand/
  table-specs.mjs) і запише ${OUT_PATH}.
  Як накотити його на локальний стенд — scripts/dev-stand/README.md.`;

/** Читання однієї таблиці allowlist-у: тільки дозволені колонки. */
async function fetchTable(client, spec) {
  if (!/^[a-z_]+$/.test(spec.table)) {
    throw new Error(`Підозріле імʼя таблиці в allowlist-і: ${spec.table}`);
  }
  const columns = spec.columns.map((column) => `"${column}"`).join(', ');
  const where = spec.where ? ` where ${spec.where}` : '';
  const { rows } = await client.query(
    `select ${columns} from public.${spec.table}${where}`,
  );
  console.log(`[dev-stand] ${spec.table}: ${rows.length} рядк.`);
  return rows;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(MISSING_URL_HELP);
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const dataset = {};
  try {
    for (const spec of TABLE_SPECS) {
      dataset[spec.table] = await fetchTable(client, spec);
    }
  } finally {
    await client.end();
  }
  writeFileSync(OUT_PATH, generateSeedSql(dataset), 'utf8');
  console.log(`[dev-stand] записано ${OUT_PATH}`);
}

// Запуск лише як CLI: імпорт модуля тестом не має лізти в БД.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(`[dev-stand] ${error.message}`);
    process.exit(1);
  });
}
