/**
 * База команди `db:showcase` (С-16а): хто має право її перестворити.
 *
 * 🔴 Право визначає позначка `COMMENT ON DATABASE`, а не вміст бази: власник
 * реєструватиметься в цьому магазині руками, тож «чужі» email-и не доводять,
 * що база чужа. Позначку ставить сам `demo-db.mjs` одразу після CREATE, ДО
 * міграцій, — обірваний накат чи сід не лишає базу без позначки.
 *
 * 🔴 Сесійний advisory-лок тримає адмін-зʼєднання батьківського процесу (до
 * службової `postgres`, яку `pg_terminate_backend` у `demo-db.mjs` не чіпає)
 * від перевірки позначки до кінця ВСІЄЇ команди: інакше друга команда
 * перестворила б базу, поки перша її наповнює.
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import type pg from 'pg';

/** Фіксоване імʼя бази команди: ні параметра, ні env (С-16а). */
export const SHOWCASE_DB_NAME = 'simplycms_showcase';
/** Позначка бази, яку команда сміє перестворювати. */
export const SHOWCASE_DB_COMMENT = 'simplycms:showcase';
/** Ключ сесійного advisory-лока (`hashtext` на боці Postgres). */
const LOCK_KEY = 'simplycms:showcase-db';

/** Адмін-зʼєднання до `postgres` + його рядок для дочірнього `demo-db.mjs`. */
export type AdminConnection = { client: pg.Client; url: string };

/** База з таким іменем є, але не позначена — команда її не чіпає. */
export class ShowcaseForeignDbError extends Error {
  constructor(name: string, comment: string | null) {
    super(
      `[showcase] База «${name}» уже існує й не позначена як база сіду ` +
        `(COMMENT = ${comment === null ? 'немає' : `«${comment}»`}). ` +
        'Команда її не перестворює, щоб не знищити чужі дані: перейменуй чи ' +
        'видали її вручну, якщо вона справді не потрібна.',
    );
    this.name = 'ShowcaseForeignDbError';
  }
}

/**
 * Виконує `fn` під сесійним локом команди; лок звільняється у `finally`.
 * Другий запуск чекає тут, доки перший не завершить усі кроки.
 */
export async function withShowcaseLock<T>(
  client: pg.Client,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query('select pg_advisory_lock(hashtext($1))', [LOCK_KEY]);
  try {
    return await fn();
  } finally {
    await client.query('select pg_advisory_unlock(hashtext($1))', [LOCK_KEY]);
  }
}

/** Чи тримає ЦЯ сесія лок команди (64-бітний ключ = classid:objid). */
async function holdsLock(client: pg.Client): Promise<boolean> {
  const { rows } = await client.query<{ held: boolean }>(
    `select exists (
       select 1 from pg_locks
        where locktype = 'advisory' and pid = pg_backend_pid() and granted
          and ((classid::bigint << 32) | objid::bigint) = hashtext($1)::bigint
     ) as held`,
    [LOCK_KEY],
  );
  return rows[0]?.held === true;
}

/** Дочірній `demo-db.mjs` із позначкою; ненульовий код — виняток. */
function runDemoDb(adminUrl: string, name: string): Promise<void> {
  const script = join(import.meta.dirname, '../demo-db.mjs');
  const args = [script, '--url', adminUrl, '--name', name];
  return new Promise((done, fail) => {
    const child = spawn(
      process.execPath,
      [...args, '--comment', SHOWCASE_DB_COMMENT],
      { stdio: 'inherit' },
    );
    child.on('error', fail);
    child.on('exit', (code) =>
      code === 0
        ? done()
        : fail(
            new Error(`[showcase] db:demo для «${name}» впав (код ${code})`),
          ),
    );
  });
}

/**
 * Готує базу `name` (С-16а) ДО будь-якого DROP: немає → створює; є з
 * позначкою → перестворює; є без позначки → `ShowcaseForeignDbError`, нічого
 * не змінено. Публічна команда передає лише `SHOWCASE_DB_NAME`; інше імʼя —
 * лише для ізоляції гейта.
 */
export async function prepareShowcaseDb(
  admin: AdminConnection,
  name: string,
): Promise<'created' | 'recreated'> {
  if (!(await holdsLock(admin.client))) {
    throw new Error(
      '[showcase] prepareShowcaseDb кличуть поза withShowcaseLock',
    );
  }
  const { rows } = await admin.client.query<{ comment: string | null }>(
    `select shobj_description(oid, 'pg_database') as comment
       from pg_database where datname = $1`,
    [name],
  );
  const existing = rows[0];
  if (existing && existing.comment !== SHOWCASE_DB_COMMENT) {
    throw new ShowcaseForeignDbError(name, existing.comment);
  }
  await runDemoDb(admin.url, name);
  return existing ? 'recreated' : 'created';
}
