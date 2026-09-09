// Накат SQL-файлів на харнес-кластер (Task 1, план В2-К1а) + хелпери
// тимчасової БД для ізоляції тестів `test:schema`.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

/**
 * Накатує SQL-файли по черзі в ОДНОМУ з'єднанні. `ON_ERROR_STOP`-семантика:
 * перша помилка кидає виняток з іменем файлу, що впав, — решта не котиться.
 */
export async function applySqlFiles(connectionString, filePaths) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
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
  } finally {
    await client.end();
  }
}

/** Унікальне імʼя тимчасової БД для одного тестового прогону. */
export function randomDbName(prefix = 'simplycms_test') {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

/** Створити тимчасову БД через адмін-з'єднання (зазвичай — до `postgres`). */
export async function createTempDatabase(adminUrl, dbName) {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    // `dbName` — завжди наш randomDbName() зсередини тестів, не зовнішній
    // вхід, тож інтерполяція в DDL тут безпечна (параметризувати CREATE
    // DATABASE неможливо — pg їх не приймає).
    await client.query(`create database "${dbName}"`);
  } finally {
    await client.end();
  }
}

/** Дропнути тимчасову БД, розірвавши перед тим активні з'єднання до неї. */
export async function dropTempDatabase(adminUrl, dbName) {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(
      `select pg_terminate_backend(pid) from pg_stat_activity
       where datname = $1 and pid <> pg_backend_pid()`,
      [dbName],
    );
    await client.query(`drop database if exists "${dbName}"`);
  } finally {
    await client.end();
  }
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
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('begin');
    let rows = [];
    for (const sql of statements) rows = (await client.query(sql)).rows;
    await client.query('rollback');
    return rows;
  } finally {
    await client.end();
  }
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
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query(sql, params);
    return rows;
  } finally {
    await client.end();
  }
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
