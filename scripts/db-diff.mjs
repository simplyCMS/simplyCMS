#!/usr/bin/env node

/**
 * Адаптер drizzle-kit → формат міграцій Supabase CLI.
 *
 * Крок 1: `drizzle-kit generate` у теці `@simplycms/schema` (порівнює
 *         `src/schema.ts` зі snapshot-ом у `drizzle/meta/`).
 * Крок 2: новий `.sql` копіюється в `supabase/migrations/<YYYYMMDDHHmmss>_<name>.sql`.
 * Крок 3: друкує шлях і нагадування про ревʼю SQL перед `pnpm db:migrate`.
 *
 * Подвійна бухгалтерія навмисна: журнал і snapshot Drizzle лишаються в
 * `packages/simplycms/schema/drizzle/` (комітяться), застосовний SQL — у
 * `supabase/migrations/`. Деталі — у README пакета схеми.
 *
 * Використання:
 *   pnpm db:diff <name>        # напр. pnpm db:diff add-product-badge
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Шляхи ───────────────────────────────────────────────────────────────────
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_DIR = join(ROOT, 'packages', 'simplycms', 'schema');
const DRIZZLE_DIR = join(SCHEMA_DIR, 'drizzle');
const JOURNAL = join(DRIZZLE_DIR, 'meta', '_journal.json');
const SUPABASE_MIGRATIONS = join(ROOT, 'supabase', 'migrations');

// ── Аргумент ────────────────────────────────────────────────────────────────
const name = process.argv[2];
if (!name || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(name)) {
  console.error('❌ Потрібне імʼя міграції: pnpm db:diff <name>');
  console.log(
    '  💡 Дозволені символи: a-z, 0-9, "-", "_" (напр. add-product-badge)',
  );
  process.exit(1);
}

/** Перелік staging-SQL у теці `out` Drizzle (без `meta/`). */
function listSql() {
  if (!existsSync(DRIZZLE_DIR)) return [];
  return readdirSync(DRIZZLE_DIR).filter((f) => f.endsWith('.sql'));
}

/** `when` (мс) останнього запису журналу → `YYYYMMDDHHmmss` в UTC. */
function timestampFromJournal(tag) {
  const journal = JSON.parse(readFileSync(JOURNAL, 'utf8'));
  const entry = journal.entries.find((e) => e.tag === tag);
  const when = new Date(entry ? entry.when : Date.now());
  return when.toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

// ── 1. Генерація діфа ───────────────────────────────────────────────────────
console.log('\n🚀 SimplyCMS — генерація міграції\n');
const before = new Set(listSql());

// 🔴 cwd — тека пакета: drizzle-kit 0.31 склеює `./${out}` і на абсолютних
// шляхах у конфізі падає з ENOENT.
try {
  execFileSync(
    'pnpm',
    [
      'exec',
      'drizzle-kit',
      'generate',
      '--config',
      './drizzle.config.ts',
      '--name',
      name,
    ],
    { cwd: SCHEMA_DIR, stdio: 'inherit' },
  );
} catch (error) {
  console.error(
    `\n❌ drizzle-kit generate впав: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}

const created = listSql().filter((f) => !before.has(f));

if (created.length === 0) {
  console.log('\n✅ Змін схеми немає — нового SQL не створено.');
  process.exit(0);
}
if (created.length > 1) {
  console.error(
    `\n❌ drizzle-kit створив кілька файлів: ${created.join(', ')}`,
  );
  console.log(
    '  💡 Стан `drizzle/` неконсистентний — розберись руками перед копіюванням.',
  );
  process.exit(1);
}

// ── 2. Копія у формат Supabase CLI ──────────────────────────────────────────
const [sqlFile] = created;
const tag = sqlFile.replace(/\.sql$/, '');
const target = join(
  SUPABASE_MIGRATIONS,
  `${timestampFromJournal(tag)}_${name}.sql`,
);

if (existsSync(target)) {
  console.error(`\n❌ Файл уже існує: ${target}`);
  process.exit(1);
}

const header = [
  `-- Згенеровано \`pnpm db:diff ${name}\` з packages/simplycms/schema/drizzle/${sqlFile}.`,
  '-- Джерело правди схеми — packages/simplycms/schema/src/schema.ts.',
  '',
].join('\n');
writeFileSync(
  target,
  header + readFileSync(join(DRIZZLE_DIR, sqlFile), 'utf8'),
  'utf8',
);

// ── 3. Підсумок ─────────────────────────────────────────────────────────────
console.log('\n✅ Міграцію створено:');
console.log(`  📄 supabase/migrations/${target.split('/').pop()}`);
console.log(
  `  🗃️  drizzle-staging: packages/simplycms/schema/drizzle/${sqlFile} (комітиться)`,
);
console.log('\n🔴 Переглянь SQL ПЕРЕД застосуванням:');
console.log(
  '  1. звір DDL з наміром (особливо DROP/RENAME — drizzle-kit не бачить перейменувань);',
);
console.log(
  '  2. RLS-політики та тригери drizzle не діфить — додай руками, якщо треба;',
);
console.log('  3. `pnpm db:migrate` — застосувати + оновити типи.\n');
