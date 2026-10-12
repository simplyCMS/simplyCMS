// Онлайн-перевірки doctor (`--online`): доступність БД і журнал міграцій.
// Ходять з DATABASE_URL (роль app_runtime), а не з MIGRATION_DATABASE_URL:
// doctor read-only, а ключ власника схеми не мусить бути на кожній машині.
// Журнал читає ядро (`simplycms/migrate`, Е8-Р13): app_runtime має право на
// нього лише через `SET ROLE app_admin` у read-only транзакції.
import { storeMigrationsDir } from './db-diff.mjs';
import { redactUrls } from './redact-urls.mjs';
import { importFromStore } from './store-core.mjs';

/** Таймаут з'єднання: недоступна БД не має підвішувати діагностику. */
export const CONNECT_TIMEOUT_MS = 3000;

const REACHABLE = 'Доступність БД (DATABASE_URL)';
const JOURNAL = 'Журнал міграцій';

const check = (id, title, status, details) => ({ id, title, status, details });
const reason = (error) =>
  redactUrls(error instanceof Error ? error.message : String(error));

/** Справжнє з'єднання з таймаутом; `pg` береться з магазину (peer ядра). */
async function probeConnection(storeRoot, connectionString) {
  const { default: pg } = await importFromStore(storeRoot, 'pg');
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  });
  await client.connect();
  try {
    await client.query('select 1');
  } finally {
    await client.end();
  }
}

/** Рядок журналу за станом: немає / розбіжність сум / ненакочені / гаразд. */
function journalCheck(rows, files, core) {
  if (rows === null)
    return check(
      'migrations-journal',
      JOURNAL,
      'error',
      'база без журналу (public.simplycms_migrations): накоти схему — pnpm simplycms db:apply',
    );
  const { pending, changed } = core.pendingMigrations(rows, files);
  if (changed.length > 0)
    return check(
      'migrations-journal',
      JOURNAL,
      'error',
      `накочені файли змінено: ${changed.join(', ')} — застосований файл не правиться, зміна йде новою міграцією`,
    );
  if (pending.length > 0)
    return check(
      'migrations-journal',
      JOURNAL,
      'warn',
      `ненакочені міграції (${pending.length}): ${pending.join(', ')} — pnpm simplycms db:apply`,
    );
  return check('migrations-journal', JOURNAL, 'ok');
}

/**
 * @param {{ storeRoot: string; env: Record<string, string> }} ctx
 * @param {{
 *   core?: { readJournal: Function; listMigrationFiles: Function; pendingMigrations: Function };
 *   probe?: (url: string) => Promise<void>;
 * }} [deps] ін'єкція для тестів
 * @returns {Promise<import('./ui.mjs').Check[]>}
 */
export async function runOnlineChecks({ storeRoot, env }, deps = {}) {
  const url = env.DATABASE_URL;
  if (!url) {
    const why = 'DATABASE_URL не задано';
    return [
      check('db-reachable', REACHABLE, 'skip', why),
      check('migrations-journal', JOURNAL, 'skip', why),
    ];
  }
  try {
    await (deps.probe ?? ((u) => probeConnection(storeRoot, u)))(url);
  } catch (error) {
    return [
      check('db-reachable', REACHABLE, 'error', reason(error)),
      check('migrations-journal', JOURNAL, 'skip', 'БД недоступна'),
    ];
  }
  const reachable = check('db-reachable', REACHABLE, 'ok');
  try {
    const core =
      deps.core ?? (await importFromStore(storeRoot, 'simplycms/migrate'));
    const files = core.listMigrationFiles(storeMigrationsDir(storeRoot));
    const rows = await core.readJournal(url);
    return [reachable, journalCheck(rows, files, core)];
  } catch (error) {
    return [
      reachable,
      check('migrations-journal', JOURNAL, 'error', reason(error)),
    ];
  }
}
