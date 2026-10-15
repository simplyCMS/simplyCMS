#!/usr/bin/env node

/**
 * Детермінований ребазлайн drizzle: `schema.ts` → `drizzle/` + `migrations/0001_init.sql`.
 *
 * До `1.0.0-rc.1` baseline не заморожено (`docs/architecture/data-layer.md`), тож
 * кожна правка `schema.ts` — це перегенерація ОДНОЇ міграції `0000_init`, а не
 * нова міграція. Раніше снапшоти правили руками; цей скрипт — єдиний шлях:
 *
 *   1. генерує у ТИМЧАСОВУ теку `drizzle.tmp` (інакше drizzle-kit дописав би другу міграцію
 *      до наявної `drizzle/`), а `drizzle/` замінює нею лише після успіху: збій генерації
 *      (напр. помилка в `schema.ts`) не лишає репо без снапшота;
 *   2. `drizzle-kit generate … --name init` з cwd пакета (без мережі й БД);
 *   3. нормалізує те, що drizzle-kit пише недетерміновано:
 *        - `when` у `meta/_journal.json` (`Date.now()`) → `0`;
 *        - `id` у `meta/0000_snapshot.json` (випадковий UUID) → константа;
 *      без цього два прогони поспіль дають диф, а `git diff` кожної хвилі тоне в шумі;
 *   4. збирає `migrations/0001_init.sql` = `drizzle/0000_init.sql` + рядки
 *      `ALLOWLIST_MIGRATION_ONLY_LINES` (два `COMMENT ON COLUMN`, яких drizzle-kit
 *      не емітить) у фіксованому місці — наприкінці.
 *
 * Ручні файли `0000_prelude`, `0002_grants`, `0003_seed`, `0004_functions` скрипт не
 * чіпає: гранти нової таблиці, сід і тригери правлять руками після нього.
 *
 * Використання:
 *   pnpm db:rebaseline                 # корінь репо
 *   node scripts/rebaseline-drizzle.mjs --root <dir>   # <dir>/packages/simplycms (тести)
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Корінь репо, де лежить цей скрипт: звідси береться бінарник drizzle-kit. */
const SCRIPT_REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Свідомі відмінності канону від виводу drizzle-kit: `schema.ts` не оголошує
 * `.comment(...)`, тож ці рядки живуть лише тут. Копія тримається і в
 * `tests/schema-sources-parity.test.ts` — навмисно: правка тексту в одному місці
 * без іншого червонить парність, а не проходить мовчки.
 */
const ALLOWLIST_MIGRATION_ONLY_LINES = [
  `COMMENT ON COLUMN "products"."id" IS 'Категорія A: ключ генерує ВИКЛИКАЧ, не БД. Для сторінок адмінки це браузер (crypto.randomUUID()), для суто серверних таблиць (themes, plugins, user_roles, profiles) — randomUUID() на сервері. DEFAULT знято навмисно — fail-loud guard проти розсинхрону оптимістичного й серверного ключа.';`,
  `COMMENT ON COLUMN "orders"."id" IS 'Категорія A: client-generated UUID. Ключ шле сервер (order-create), DEFAULT знято в Е1а — сітка перестала страхувати після Е0.';`,
];

/**
 * Стала відповідь на `id` снапшота. Це не `prevId` (нульовий UUID «без батька»):
 * наступний `db:diff` візьме її як `prevId` свого снапшота, тож вона мусить
 * відрізнятися від нульової, а інших вимог до неї drizzle-kit не ставить.
 */
const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000001';

/** Роздільник операторів drizzle-kit; у каноні стоїть і між дописаними рядками. */
const BREAKPOINT = '--> statement-breakpoint\n';

/** Замінює рівно одне входження; нуль збігів означає, що формат drizzle-kit змінився. */
function replaceOnce(text, pattern, replacement, what) {
  const hits =
    text.match(new RegExp(pattern.source, `${pattern.flags}g`)) ?? [];
  if (hits.length !== 1) {
    throw new Error(
      `${what}: очікувалось рівно 1 збіг, знайдено ${hits.length} — формат drizzle-kit змінився, перевір нормалізацію`,
    );
  }
  return text.replace(pattern, replacement);
}

function parseRoot(argv) {
  const at = argv.indexOf('--root');
  if (at === -1) return SCRIPT_REPO;
  const value = argv[at + 1];
  if (!value) throw new Error('--root вимагає теку');
  return resolve(value);
}

function rebaseline(root) {
  const pkgDir = join(root, 'packages', 'simplycms');
  const drizzleDir = join(pkgDir, 'drizzle');
  // Відносне імʼя: drizzle-kit 0.31 склеює `./${out}`, абсолютний шлях ламає (ENOENT).
  const tmpName = 'drizzle.tmp';
  const tmpDir = join(pkgDir, tmpName);
  const canonFile = join(pkgDir, 'migrations', '0001_init.sql');
  if (!existsSync(join(pkgDir, 'src', 'schema', 'schema.ts'))) {
    throw new Error(`немає ${pkgDir}/src/schema/schema.ts — це не корінь репо`);
  }

  rmSync(tmpDir, { recursive: true, force: true });

  // 🔴 `--out` відносний, cwd — тека пакета: drizzle-kit 0.31 склеює `./${out}`
  // і на абсолютному шляху падає з ENOENT (див. `drizzle.config.ts`).
  try {
    execFileSync(
      join(SCRIPT_REPO, 'node_modules', '.bin', 'drizzle-kit'),
      [
        'generate',
        '--dialect',
        'postgresql',
        '--schema',
        './src/schema/schema.ts',
        '--out',
        `./${tmpName}`,
        '--name',
        'init',
      ],
      { cwd: pkgDir, stdio: ['ignore', 'ignore', 'inherit'] },
    );
  } catch (error) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw error;
  }

  try {
    const journalFile = join(tmpDir, 'meta', '_journal.json');
    writeFileSync(
      journalFile,
      replaceOnce(
        readFileSync(journalFile, 'utf8'),
        /"when": \d+/,
        '"when": 0',
        '_journal.json',
      ),
    );
    const snapshotFile = join(tmpDir, 'meta', '0000_snapshot.json');
    writeFileSync(
      snapshotFile,
      replaceOnce(
        readFileSync(snapshotFile, 'utf8'),
        /^(\{\s*"id": ")[0-9a-f-]{36}(")/,
        `$1${SNAPSHOT_ID}$2`,
        '0000_snapshot.json',
      ),
    );

    const generated = readFileSync(join(tmpDir, '0000_init.sql'), 'utf8');
    const canon = `${[generated.replace(/\n+$/, ''), ...ALLOWLIST_MIGRATION_ONLY_LINES].join(BREAKPOINT)}\n`;
    // Порядок: спершу `drizzle/` (rename — найімовірніше місце збою), потім канон:
    // збій rename не лишає новий канон поруч зі старим снапшотом.
    rmSync(drizzleDir, { recursive: true, force: true });
    renameSync(tmpDir, drizzleDir);
    writeFileSync(canonFile, canon);
  } finally {
    // Після успішного rename теки вже нема; при збої нормалізації — не лишаємо сміття.
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

try {
  rebaseline(parseRoot(process.argv.slice(2)));
  console.log(
    '✅ drizzle/ і migrations/0001_init.sql перегенеровано. Далі: ручні файли (0002_grants, 0003_seed, 0004_functions), pnpm template:sync.',
  );
} catch (error) {
  console.error(
    `❌ rebaseline: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}
