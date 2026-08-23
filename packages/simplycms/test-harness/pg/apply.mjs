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
 * Одноразовий запит: підключитись, виконати, віддати рядки, відключитись.
 *
 * 🔴 Навмисно тут, а не прямий `new pg.Client()` у тестах: `pg` не має
 * власних типів (`@types/pg` не встановлено — окрема залежність поза
 * скоупом Task 1), тож `.test.ts`, що імпортує `pg` напряму, валить
 * `tsc --noEmit` (TS7016). `.mjs` не типочекається (`checkJs` вимкнено),
 * тому імпорт `pg` тут для `tsc` невидимий.
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
