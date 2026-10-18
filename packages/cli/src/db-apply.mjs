// simplycms db:apply — накат `db/migrations` магазину. Усю роботу робить ядро
// (`simplycms/migrate`, Е8-Р2): журнал із контрольними сумами, advisory-лок,
// транзакція на файл. Тут — лише розбір аргументів, env і друк.
//
// Коди виходу (Е8-О8): 0 — гаразд; 3 — `--check` і є ненакочені; 1 — помилка.
import { findStoreRoot, readStoreEnv } from './context.mjs';
import { storeMigrationsDir } from './db-diff.mjs';
import { redactUrls } from './redact-urls.mjs';
import { importFromStore } from './store-core.mjs';
import { begin, finish, say } from './ui.mjs';

export const EXIT_PENDING = 3;

/** @param {string[]} argv */
export function parseDbApplyArgs(argv) {
  let dryRun = false;
  let check = false;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--check') check = true;
    else throw new Error(`Невідомий аргумент db:apply: ${arg}`);
  }
  return { dryRun, check };
}

/**
 * Друк помилки ядра: ім'я, код і повідомлення, пропущене через `redactUrls`.
 * Режиму «повний текст» немає свідомо — вивід CLI потрапляє в лог деплою.
 * @param {unknown} error
 */
export function describeError(error) {
  const err =
    /** @type {{ name?: string; code?: string; message?: string }} */ (
      error instanceof Error ? error : { message: String(error) }
    );
  // Базове `Error` — шум: інформативні лише спеціалізовані імена (MigrationChecksumError…).
  const name = err.name === 'Error' ? undefined : err.name;
  const head = [name, err.code].filter(Boolean).join(' ');
  return redactUrls(`${head ? `${head}: ` : ''}${err.message ?? ''}`);
}

const DEFAULT_UI = { begin, finish, ...say };

/**
 * @param {string[]} argv
 * @param {{
 *   storeRoot?: string;
 *   env?: Record<string, string>;
 *   core?: { applyMigrations: (options: Record<string, unknown>) => Promise<{ applied: string[]; pending: string[] }> };
 *   ui?: typeof DEFAULT_UI;
 * }} [deps] ін'єкція для тестів: фейкове ядро, env і вивід
 * @returns {Promise<number>} код виходу; виставляє його `index.mjs`
 */
export async function run(argv, deps = {}) {
  const { dryRun, check } = parseDbApplyArgs(argv);
  const ui = deps.ui ?? DEFAULT_UI;
  ui.begin('simplycms db:apply');
  try {
    const storeRoot = deps.storeRoot ?? findStoreRoot();
    const env = deps.env ?? readStoreEnv(storeRoot);
    // 🔴 Лише MIGRATION_DATABASE_URL (роль накату, SUPERUSER). Падати назад на
    // DATABASE_URL не можна: роль app_runtime схему створювати не вміє, а
    // «мовчки вдалося б» на чужій базі гірше за відмову.
    const connectionString = env.MIGRATION_DATABASE_URL;
    if (!connectionString) {
      ui.error(
        'Не задано MIGRATION_DATABASE_URL — підключення ролі накату (SUPERUSER кластера, не ' +
          'app_runtime із DATABASE_URL). Додай його в .env.local або в env процесу.',
      );
      ui.finish('Накат не виконано.');
      return 1;
    }
    const core =
      deps.core ?? (await importFromStore(storeRoot, 'simplycms/migrate'));
    const report = await core.applyMigrations({
      connectionString,
      dir: storeMigrationsDir(storeRoot),
      runtimeUrl: env.DATABASE_URL || undefined,
      dryRun: dryRun || check,
      log: (line) => ui.info(redactUrls(line)),
    });
    return printReport(ui, report, { dryRun, check });
  } catch (error) {
    ui.error(describeError(error));
    ui.finish('Накат не виконано.');
    return 1;
  }
}

/** Підсумок успішного прогону й код виходу. */
function printReport(ui, report, { dryRun, check }) {
  if (dryRun || check) {
    if (report.pending.length === 0) {
      ui.success('Нічого накочувати: усі міграції в журналі.');
      ui.finish('Готово.');
      return 0;
    }
    ui.warn(`До накату ${report.pending.length}: ${report.pending.join(', ')}`);
    ui.finish(
      check ? 'Є ненакочені міграції (--check).' : 'dry-run: базу не змінено.',
    );
    return check ? EXIT_PENDING : 0;
  }
  if (report.applied.length === 0)
    ui.success('Нічого накочувати: усі міграції в журналі.');
  else
    ui.success(
      `Накочено ${report.applied.length}: ${report.applied.join(', ')}`,
    );
  ui.finish('Готово.');
  return 0;
}
