// Накат SQL-файлів на харнес-кластер (Task 1, план В2-К1а) + хелпери
// тимчасової БД для ізоляції тестів `test:schema`.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/** Канон міграцій ядра — та сама тека, що їде в tarball пакета. */
export const CANON_DIR = fileURLToPath(
  new URL('../../migrations', import.meta.url),
);

/**
 * Накат КАНОНУ — лише через `applyMigrations` (Е8-Р2): харнес міряє ту саму
 * реалізацію накату, що й прод, разом із журналом. Повертає звіт накату.
 *
 * 🔴 Імпорт динамічний, а не статичний: модуль ядра — TypeScript, а
 * `scripts/live-smoke.mjs` імпортує цей файл чистим `node` (лише
 * `withDbName`). Статичний імпорт `.ts` поклав би live-smoke ще до старту.
 *
 * @returns {Promise<import('../../src/migrate/index.ts').ApplyReport>}
 */
export async function applyCanon(connectionString) {
  const { applyMigrations } = await import('../../src/migrate/index.ts');
  return applyMigrations({ connectionString, dir: CANON_DIR });
}

/**
 * 🔴 Стеля одночасних ОДНОРАЗОВИХ з'єднань харнесу на процес (Е8, фікс D).
 *
 * Кожен хелпер нижче відкриває власний `pg.Client` і закриває його після
 * запиту. Поки виклики йдуть послідовно, це одне з'єднання; але фікстура, що
 * мапить N id через `Promise.all` (так робить `items()` у `fixtures/reviews.ts`
 * для 101 id), відкриває N з'єднань за мілісекунди — і `max_connections`
 * кластера (100 у дефолтному образі) падає випадково, залежно від того, як
 * швидко попередні встигли закритись. Стеля тут, а не послідовність у
 * кожній фікстурі: тоді паралельний мап у новому тесті безпечний за
 * побудовою, а семантика «запит = окреме з'єднання» не змінюється.
 *
 * Чому 4: файл додатково тримає пул ядра (`simplycms/db`, дефолт `pg` — 10)
 * і явних тримачів блокувань; із цією стелею проєкт `pg` зелений на кластері
 * з `max_connections=20`, заміряний пік — 5 з'єднань (звіт фіксу D Е8).
 * Тримачі, яким треба жити довго (`advisory-lock`, `holder` у `migrate-*`),
 * стелю НЕ беруть — інакше заблокований запит міг би чекати слота, який
 * тримає він сам.
 */
const SHORT_CONNECTIONS_MAX = 4;
let shortActive = 0;
/** @type {Array<() => void>} */
const shortWaiters = [];

/**
 * Виконати `fn` з одноразовим клієнтом під стелею `SHORT_CONNECTIONS_MAX`.
 * Слот передається наступному в черзі напряму (FIFO), без гонки за лічильник.
 *
 * @template T
 * @param {string} connectionString
 * @param {(client: pg.Client) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withShortClient(connectionString, fn) {
  if (shortActive < SHORT_CONNECTIONS_MAX) shortActive++;
  else await new Promise((resolve) => shortWaiters.push(resolve));
  try {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  } finally {
    const next = shortWaiters.shift();
    if (next) next();
    else shortActive--;
  }
}

/**
 * Накатує SQL-файли по черзі в ОДНОМУ з'єднанні. `ON_ERROR_STOP`-семантика:
 * перша помилка кидає виняток з іменем файлу, що впав, — решта не котиться.
 * Лише для НЕ-міграційного SQL (демо-сід, фікстури); канон — `applyCanon`.
 */
export async function applySqlFiles(connectionString, filePaths) {
  await withShortClient(connectionString, async (client) => {
    for (const filePath of filePaths) {
      const sql = readFileSync(filePath, 'utf8');
      try {
        // Просте query-протокол (без параметрів) дозволяє кілька
        // `;`-розділених стейтментів в одному виклику — файл міграції як є.
        await client.query(sql);
      } catch (err) {
        throw new Error(`Накат ${filePath} впав: ${err.message}`, {
          cause: err,
        });
      }
    }
  });
}

/** Унікальне імʼя тимчасової БД для одного тестового прогону. */
export function randomDbName(prefix = 'simplycms_test') {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

/** Створити тимчасову БД через адмін-з'єднання (зазвичай — до `postgres`). */
export async function createTempDatabase(adminUrl, dbName) {
  await withShortClient(adminUrl, async (client) => {
    // `dbName` — завжди наш randomDbName() зсередини тестів, не зовнішній
    // вхід, тож інтерполяція в DDL тут безпечна (параметризувати CREATE
    // DATABASE неможливо — pg їх не приймає).
    await client.query(`create database "${dbName}"`);
  });
}

/** Дропнути тимчасову БД, розірвавши перед тим активні з'єднання до неї. */
export async function dropTempDatabase(adminUrl, dbName) {
  await withShortClient(adminUrl, async (client) => {
    await client.query(
      `select pg_terminate_backend(pid) from pg_stat_activity
       where datname = $1 and pid <> pg_backend_pid()`,
      [dbName],
    );
    await client.query(`drop database if exists "${dbName}"`);
  });
}

/** Той самий кластер, інша БД у шляху підключення. */
export function withDbName(connectionString, dbName) {
  const url = new URL(connectionString);
  url.pathname = `/${dbName}`;
  return url.toString();
}

/**
 * Той самий кластер і БД, але під іншою роллю БД. Потрібно негативним
 * контролям: fail-closed доводиться лише РЕАЛЬНИМ конектом під `app_runtime`,
 * а не `SET ROLE` з-під власника (власник обходить гранти за побудовою).
 * Харнес автентифікує `trust`, тож пароль не потрібен.
 */
export function withUser(connectionString, user) {
  const url = new URL(connectionString);
  url.username = user;
  return url.toString();
}

/**
 * Виконати послідовність SQL-стейтментів в ОДНІЙ транзакції й відкотити її.
 * Повертає рядки останнього стейтмента. Помилка будь-якого — прокидується
 * назовні (саме її і ловлять негативні контролі).
 *
 * @returns {Promise<any[]>} рядки останнього стейтмента (див. нижче про тип)
 */
export async function queryInTransaction(connectionString, statements) {
  return withShortClient(connectionString, async (client) => {
    await client.query('begin');
    let rows = [];
    for (const sql of statements) rows = (await client.query(sql)).rows;
    await client.query('rollback');
    return rows;
  });
}

/**
 * Одноразовий запит: підключитись, виконати, віддати рядки, відключитись.
 *
 * 🔴 Тип результату виписаний ЯВНО, і це не формальність. `checkJs` вимкнено,
 * але tsc усе одно ВИВОДИТЬ типи цього модуля для `.test.ts`, які його
 * імпортують. З Task 6 у репо зʼявились `@types/pg` (драйвер став
 * рантайм-залежністю ядра), і `client.query(sql, params)` почав резолвитись
 * в overload з `R extends any[]` — тобто рядки виводились як `any[][]`, і
 * кожен виклик у гейтах падав із TS2352/TS2345. Тести звертаються до рядків
 * власними формами (`as { rolname: string }[]`), тож чесний тип довільного
 * SQL-результату тут саме `any[]` — вужчий зробив би касти брехливими.
 *
 * @returns {Promise<any[]>}
 */
export async function queryRows(connectionString, sql, params = []) {
  return withShortClient(
    connectionString,
    async (client) => (await client.query(sql, params)).rows,
  );
}

/** Чи вдається підключитись до `connectionString` (для негативних тестів). */
export async function canConnect(connectionString) {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}
