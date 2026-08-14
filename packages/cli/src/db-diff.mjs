// simplycms db:diff [--write] — порівняння міграцій магазину з міграціями
// встановленого ядра (§4.4 спеки): нові міграції ядра — список і копіювання
// під --write (forward-only); власні — інформаційно; спільне імʼя з різним
// вмістом — error і жодного запису (міграції immutable). Чистий компаратор
// звідси переиспользовує doctor (перевірка №7) — реалізація одна.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { findStoreRoot } from './context.mjs';
import { fileDiffers } from './host-drift.mjs';
import { begin, finish, say, showSteps } from './ui.mjs';

/** Тека міграцій магазину. */
export const storeMigrationsDir = (storeRoot) =>
  join(storeRoot, 'supabase', 'migrations');

/** Тека міграцій встановленого ядра (tarball @simplycms/schema). */
export const schemaMigrationsPath = (storeRoot) =>
  join(storeRoot, 'node_modules', '@simplycms', 'schema', 'migrations');

/** Та сама тека, але з гучною перевіркою наявності — для команди db:diff. */
export function assertSchemaMigrations(storeRoot) {
  const dir = schemaMigrationsPath(storeRoot);
  if (!existsSync(dir))
    throw new Error(
      `Не знайдено ${dir}: встановлений @simplycms/schema не везе migrations/ — ` +
        'це стара версія ядра. Онови його (pnpm simplycms update) і повтори.',
    );
  return dir;
}

/** SQL-файли теки, відсортовані; відсутня тека → порожній список. */
export const listSqlFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith('.sql'))
        .sort()
    : [];

/**
 * Чисте порівняння тек міграцій за іменами файлів: `missing` — є в ядрі,
 * немає в магазині; `own` — лише в магазині (його власні); `changed` —
 * спільне імʼя з різним вмістом (порушення immutable).
 * @param {string} storeDir
 * @param {string} schemaDir
 * @returns {{ missing: string[]; own: string[]; changed: string[] }}
 */
export function compareMigrations(storeDir, schemaDir) {
  const store = listSqlFiles(storeDir);
  const core = listSqlFiles(schemaDir);
  return {
    missing: core.filter((name) => !store.includes(name)),
    own: store.filter((name) => !core.includes(name)),
    changed: core.filter(
      (name) =>
        store.includes(name) &&
        fileDiffers(join(schemaDir, name), join(storeDir, name)),
    ),
  };
}

/** Докопіювати названі міграції ядра в магазин (тільки додавання, §4.4). */
export function copyMigrations(storeDir, schemaDir, names) {
  mkdirSync(storeDir, { recursive: true });
  for (const name of names) cpSync(join(schemaDir, name), join(storeDir, name));
}

/** @param {string[]} argv */
export function parseDbDiffArgs(argv) {
  let write = false;
  for (const arg of argv) {
    if (arg === '--write') write = true;
    else throw new Error(`Невідомий аргумент db:diff: ${arg}`);
  }
  return { write };
}

/** @param {string[]} argv */
export async function run(argv) {
  const { write } = parseDbDiffArgs(argv);
  begin('simplycms db:diff');
  const storeRoot = findStoreRoot();
  const schemaDir = assertSchemaMigrations(storeRoot);
  const storeDir = storeMigrationsDir(storeRoot);
  const { missing, own, changed } = compareMigrations(storeDir, schemaDir);
  if (changed.length > 0) {
    say.error(
      `Спільні міграції розійшлися вмістом: ${changed.join(', ')}.\n` +
        'Міграції immutable — нічого не записано, розберися вручну.',
    );
    process.exitCode = 1;
    finish('Конфлікт вмісту міграцій.');
    return;
  }
  if (own.length > 0)
    say.info(`Власні міграції магазину (ядро їх не знає): ${own.join(', ')}`);
  if (missing.length === 0) {
    say.success('Нових міграцій ядра немає — магазин не відстає.');
    finish('Вже зроблено.');
    return;
  }
  if (!write) {
    say.warn(`Нові міграції ядра (${missing.length}): ${missing.join(', ')}`);
    showSteps([
      'pnpm simplycms db:diff --write   # скопіювати їх у supabase/migrations/',
    ]);
    finish('Є що забрати (--write).');
    return;
  }
  copyMigrations(storeDir, schemaDir, missing);
  say.success(
    `Скопійовано ${missing.length} нових міграцій ядра: ${missing.join(', ')}`,
  );
  showSteps([
    'git diff             # ревʼю доданих міграцій',
    'supabase db push     # накатити їх на БД магазину',
  ]);
  finish('Готово.');
}
