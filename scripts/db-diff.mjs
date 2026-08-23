#!/usr/bin/env node

/**
 * Адаптер drizzle-kit → канон міграцій ядра.
 *
 * Крок 1: `drizzle-kit generate` у теці пакета `simplycms` (порівнює
 *         `src/schema/schema.ts` зі snapshot-ом у `drizzle/meta/`).
 * Крок 2: новий `.sql` копіюється в `packages/simplycms/migrations/NNNN_<name>.sql`
 *         — наступним вільним номером канону (B13).
 * Крок 3: друкує шлях і нагадування про ревʼю SQL.
 *
 * Подвійна бухгалтерія навмисна: журнал і snapshot Drizzle лишаються в
 * `packages/simplycms/drizzle/` (комітяться), застосовний SQL — у каноні.
 * Нумерація в них РІЗНА: drizzle рахує від нуля свій журнал, канон — від
 * `0000_prelude.sql`, який drizzle не породжував і не бачить. Деталі — у
 * `packages/simplycms/migrations/README.md`.
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
const SCHEMA_DIR = join(ROOT, 'packages', 'simplycms');
const DRIZZLE_DIR = join(SCHEMA_DIR, 'drizzle');
const CANON_DIR = join(SCHEMA_DIR, 'migrations');
const CANON_REL = 'packages/simplycms/migrations';

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

/**
 * Наступний вільний номер канону, 4 цифри. Порядок накату в каноні задає
 * саме імʼя файлу (`0000_prelude` → `0001_init` → …), тож новий діф мусить
 * лягти суворо після найбільшого наявного — дірки й повтори зламали б накат
 * на чисту БД.
 */
function nextCanonPrefix() {
  const used = readdirSync(CANON_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => Number.parseInt(f.slice(0, 4), 10))
    .filter((n) => Number.isInteger(n));
  return String(Math.max(-1, ...used) + 1).padStart(4, '0');
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

// ── 2. Копія в канон міграцій ядра ──────────────────────────────────────────
const [sqlFile] = created;
const target = join(CANON_DIR, `${nextCanonPrefix()}_${name}.sql`);

if (existsSync(target)) {
  console.error(`\n❌ Файл уже існує: ${target}`);
  process.exit(1);
}

const header = [
  `-- Згенеровано \`pnpm db:diff ${name}\` з packages/simplycms/drizzle/${sqlFile}.`,
  '-- Джерело правди схеми — packages/simplycms/src/schema/schema.ts.',
  '',
].join('\n');
writeFileSync(
  target,
  header + readFileSync(join(DRIZZLE_DIR, sqlFile), 'utf8'),
  'utf8',
);

// ── 3. Підсумок ─────────────────────────────────────────────────────────────
console.log('\n✅ Міграцію створено:');
console.log(`  📄 ${CANON_REL}/${target.split('/').pop()}`);
console.log(
  `  🗃️  drizzle-staging: packages/simplycms/drizzle/${sqlFile} (комітиться)`,
);
console.log('\n🔴 Переглянь SQL ПЕРЕД застосуванням:');
console.log(
  '  1. звір DDL з наміром (особливо DROP/RENAME — drizzle-kit не бачить перейменувань);',
);
console.log(
  '  2. ролі, гранти й функції drizzle не діфить — додай руками, якщо треба;',
);
console.log(
  '  3. `pnpm test:schema` — накат усього канону на чисту БД харнеса.\n',
);
