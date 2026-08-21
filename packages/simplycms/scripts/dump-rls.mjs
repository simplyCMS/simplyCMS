// Дамп RLS-стану схеми `public` у фікстуру для parity-тесту.
// Запуск: node packages/simplycms/scripts/dump-rls.mjs
// Читає БД лише на select — жодних записів.
import { config as loadEnv } from 'dotenv';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../../.env.local') });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL не заданий (.env.local)');
  process.exit(1);
}

const POLICIES_SQL = `
  select schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
  from pg_policies
  where schemaname = 'public'
  order by tablename, policyname
`;

const RLS_TABLES_SQL = `
  select c.relname as tablename
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = true
  order by c.relname
`;

const client = new pg.Client({ connectionString: url });
await client.connect();
const policies = (await client.query(POLICIES_SQL)).rows;
const rlsEnabledTables = (await client.query(RLS_TABLES_SQL)).rows.map(
  (r) => r.tablename,
);
await client.end();

const out = resolve(here, '../src/schema/__tests__/fixtures/rls-policies.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `${JSON.stringify({ policies, rlsEnabledTables }, null, 2)}\n`,
  'utf8',
);
console.log(
  `Записано ${policies.length} політик і ${rlsEnabledTables.length} rls-таблиць → ${out}`,
);
