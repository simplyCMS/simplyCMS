// Паролі БД магазину у файлі секретів для `dokploy.mjs provision`.
// Пишуться ДО `postgres.create` (з тимчасовим хостом): обрив між створенням БД і записом
// не губить пароль, а повтор доводить хост за appName із Dokploy.
import { randomBytes } from 'node:crypto';

import { ensureGitignored, readSecret, setSecret } from './secrets-store.mjs';

export const PENDING_HOST = 'pending';
const KEYS = ['MIGRATION_DATABASE_URL', 'DATABASE_URL'];
const url = (user, password, host, db) =>
  `postgresql://${user}:${password}@${host}:5432/${db}`;

/** `pending` — обидва URL з тимчасовим хостом (обрив provision), `custom` — внесені власником, `none`. */
export function dbSecretsKind(path) {
  const values = KEYS.map((key) => readSecret(path, key)).filter(Boolean);
  if (values.length === 0) return 'none';
  return values.length === KEYS.length &&
    values.every((v) => v.includes(`@${PENDING_HOST}:`))
    ? 'pending'
    : 'custom';
}

/**
 * Паролі ролі накату (суперкористувач `postgres` сервісу БД) й `app_runtime` → обидва URL; повертає
 * пароль ролі накату.
 * Тимчасові URL після обриву перевикористовуються (пароль, якого БД ще не бачила, не губиться
 * і не перегенеровується); внесені власником перезаписуються лише тут — після `--confirm`.
 */
export function reserveDbSecrets(path, dbName) {
  if (dbSecretsKind(path) === 'pending')
    return /\/\/postgres:([^@]+)@/.exec(readSecret(path, KEYS[0]))[1];
  const owner = randomBytes(24).toString('hex');
  const runtime = randomBytes(24).toString('hex');
  setSecret(path, KEYS[0], url('postgres', owner, PENDING_HOST, dbName));
  setSecret(path, KEYS[1], url('app_runtime', runtime, PENDING_HOST, dbName));
  ensureGitignored(path);
  return owner;
}

/** БД уже є, а URL у файлі секретів немає — пароль втрачено: явна помилка з дією. */
export function assertDbSecrets(path, dbName) {
  const missing = KEYS.filter((key) => !readSecret(path, key));
  if (missing.length > 0)
    throw new Error(
      `${dbName} існує, але у файлі секретів немає ${missing.join(', ')}: пароль власника втрачено. ` +
        'Змініть пароль у Dokploy (postgres.changePassword) і внесіть URL у файл вручну, ' +
        `або (лише за згодою власника, БД порожня) видаліть ${dbName} і повторіть provision`,
    );
}

/** Підставляє справжній хост (appName) замість тимчасового; для вже готового URL — нічого. */
export function bindDbHost(path, appName) {
  for (const key of KEYS) {
    const value = readSecret(path, key);
    setSecret(path, key, value.replace(`@${PENDING_HOST}:`, `@${appName}:`));
  }
}
