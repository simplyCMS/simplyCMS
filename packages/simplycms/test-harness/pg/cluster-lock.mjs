// Сесійні advisory-замки харнеса на рівні КЛАСТЕРА. `pg_advisory_lock` діє в межах однієї БД
// (ключ замка включає OID бази), а ролі й їх паролі — об'єкти кластера: два прогони, що
// беруть «той самий» замок через різні БД (`PG_HARNESS_URL` з іншою БД, свіжа БД файла),
// не серіалізувались би. Тому замок береться завжди в одній фіксованій БД кластера.
import pg from 'pg';
import { withDbName } from './apply.mjs';

/** БД, у якій живуть замки кластера: є в кожному кластері після `initdb` і в образі `postgres`. */
export const CLUSTER_LOCK_DB = 'postgres';

/** Підготовка ролей кластера (`roles.mjs`). */
export const ROLES_LOCK = 'simplycms-harness-roles';

/**
 * Запис пароля `app_runtime` (рядок ролі в `pg_authid`). Два одночасні `alter role` одного
 * рядка з різних прогонів на одному кластері дають `tuple concurrently updated` (XX000), тож
 * файли, що пишуть пароль, тримають цей замок увесь час, поки пишуть.
 */
export const RUNTIME_PASSWORD_LOCK = 'simplycms-harness-app-runtime-password';

/**
 * Взяти сесійний замок `name` кластера, до якого веде `url` (БД у шляху байдужа). Чекає, поки
 * замок тримає інший прогін. Замок живе, доки не викликано `release` (закриття з'єднання).
 *
 * @returns {Promise<{ release: () => Promise<void> }>}
 */
export async function holdClusterLock(url, name) {
  const client = new pg.Client({
    connectionString: withDbName(url, CLUSTER_LOCK_DB),
  });
  await client.connect();
  try {
    await client.query('select pg_advisory_lock(hashtextextended($1, 0))', [
      name,
    ]);
  } catch (err) {
    await client.end().catch(() => {});
    throw err;
  }
  return { release: () => client.end() };
}

/**
 * `fn` під замком `name` кластера; замок відпускається і на помилці `fn`.
 *
 * @template T
 * @param {string} url
 * @param {string} name
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withClusterLock(url, name, fn) {
  const lock = await holdClusterLock(url, name);
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
