// Онлайн-перевірки БД для `doctor --online` і `status`: доступність, журнал міграцій,
// наповнення (власник, профіль, листи) і спільний кластер.
// Ходять з DATABASE_URL (роль app_runtime), а не з MIGRATION_DATABASE_URL:
// doctor read-only, а ключ власника схеми не мусить бути на кожній машині.
// Журнал читає ядро (`simplycms/migrate`, Е8-Р13): app_runtime має право на
// нього лише через `SET ROLE app_admin` у read-only транзакції.
import { storeMigrationsDir } from './db-diff.mjs';
import { clusterCheck, clusterSkip } from './doctor-cluster-check.mjs';
import {
  check,
  JOURNAL,
  journalCheck,
  reason,
  storeFactChecks,
} from './online-state-checks.mjs';
import { importFromStore } from './store-core.mjs';

/** Бюджет на з'єднання й запит: недоступна БД не має підвішувати діагностику. */
export const CONNECT_TIMEOUT_MS = 3000;

const REACHABLE = 'Доступність БД (DATABASE_URL)';
const FACTS = 'Наповнення магазину';

/** Позначка «перевірити не вдалося» (skip), а не «БД зламана» (error). */
const unverifiable = (message) =>
  Object.assign(new Error(message), { skip: true });

/** Справжнє з'єднання з таймаутом; `pg` береться з магазину (peer ядра). */
async function probeConnection(storeRoot, connectionString) {
  let pg;
  try {
    ({ default: pg } = await importFromStore(storeRoot, 'pg'));
  } catch (error) {
    if (error?.code !== 'MODULE_NOT_FOUND') throw error;
    throw unverifiable(
      'пакет pg не встановлено в магазині: встанови залежності (pnpm install) ' +
        'або додай драйвер — pnpm add pg@<peer ядра> (діапазон скаже перевірка pg)',
    );
  }
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

/**
 * @param {{ storeRoot: string; env: Record<string, string> }} ctx
 * @param {{
 *   core?: { readJournal: Function; readStoreFacts: Function; listMigrationFiles: Function; pendingMigrations: Function; findForeignDatabases: Function };
 *   probe?: (url: string) => Promise<void>;
 * }} [deps] ін'єкція для тестів
 * @returns {Promise<import('./ui.mjs').Check[]>}
 */
export async function runOnlineChecks({ storeRoot, env }, deps = {}) {
  const url = env.DATABASE_URL;
  /** Усе, що залежить від БД, — skip з однією причиною. */
  const skipped = (why) => [
    check('migrations-journal', JOURNAL, 'skip', why),
    check('store-state', FACTS, 'skip', why),
    clusterSkip(why),
  ];
  if (!url)
    return [
      check('db-reachable', REACHABLE, 'skip', 'DATABASE_URL не задано'),
      ...skipped('DATABASE_URL не задано'),
    ];
  try {
    await (deps.probe ?? ((u) => probeConnection(storeRoot, u)))(url);
  } catch (error) {
    if (error?.skip)
      return [
        check('db-reachable', REACHABLE, 'skip', error.message),
        ...skipped('немає драйвера pg'),
      ];
    return [
      check('db-reachable', REACHABLE, 'error', reason(error)),
      ...skipped('БД недоступна'),
    ];
  }
  const reachable = check('db-reachable', REACHABLE, 'ok');
  let core;
  try {
    core = deps.core ?? (await importFromStore(storeRoot, 'simplycms/migrate'));
  } catch (error) {
    return [
      reachable,
      check('migrations-journal', JOURNAL, 'error', reason(error)),
      check('store-state', FACTS, 'skip', 'ядро магазину недоступне'),
      clusterSkip('ядро магазину недоступне'),
    ];
  }
  const options = { timeoutMs: CONNECT_TIMEOUT_MS };
  // Три незалежні читання паралельно: послідовні 3 + 3 + 3 с не вкладались би в бюджет `status`.
  const [journal, facts, cluster] = await Promise.all([
    (async () => {
      try {
        const files = core.listMigrationFiles(storeMigrationsDir(storeRoot));
        return journalCheck(await core.readJournal(url, options), files, core);
      } catch (error) {
        return check('migrations-journal', JOURNAL, 'error', reason(error));
      }
    })(),
    core
      .readStoreFacts(url, options)
      .then(storeFactChecks, (error) => [
        check('store-state', FACTS, 'error', reason(error)),
      ]),
    clusterCheck(url, core, CONNECT_TIMEOUT_MS),
  ]);
  return [reachable, journal, ...facts, cluster];
}
