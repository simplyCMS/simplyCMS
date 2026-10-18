import type pg from 'pg';
import { newScramVerifier } from './scram';

/** Роль, якою застосунок конектиться в рантаймі (`0000_prelude.sql`). */
const RUNTIME_ROLE = 'app_runtime';

/**
 * Друкований ASCII: для нього SASLprep тотожний, тож верифікатор, порахований
 * тут, і логін через libpq чи node-postgres сходяться. Для решти символів
 * libpq нормалізує пароль SASLprep, а node-postgres — ні; SASLprep не робимо.
 */
const PASSWORD_ALPHABET = /^[\x20-\x7e]+$/;

/**
 * Підказка — за кодом помилки, а не одна на всі: `XX000` (`tuple concurrently updated`) і
 * `40001` означають, що рядок ролі одночасно змінило інше з'єднання (роль кластерна, а не
 * бази), і порада «дайте право ALTER ROLE» там вела б не туди. Інші коди — без діагнозу.
 */
const CONCURRENT_HINT =
  "; найімовірніше, роль одночасно змінило інше з'єднання (роль спільна для всього " +
  'кластера Postgres) — повторіть старт';
const HINTS: Record<string, string> = {
  '42501': "; з'єднання накату мусить мати право ALTER ROLE",
  XX000: CONCURRENT_HINT,
  '40001': CONCURRENT_HINT,
};

const fail = (reason: string) =>
  new Error(`[simplycms/migrate] runtimeUrl: ${reason}`);

/** Що синхронізувати: пароль `app_runtime` або причина, чому нічого. */
export type RuntimeCredentials =
  { password: string } | { skip: 'інший користувач' | 'його немає в URL' };

/**
 * Розбирає `runtimeUrl` так само, як `pg-connection-string` (`index.js`):
 * голий `%` чи пробіл спершу екрануються `encodeURI`, тож рядок, який `pg`
 * з'єднує, тут не кидає `URIError`. Викликається ДО накату: поганий пароль
 * зупиняє старт, не зачепивши базу.
 *
 * 🔴 Жодна помилка не містить ні рядка підключення, ні пароля.
 */
export function parseRuntimeCredentials(
  runtimeUrl: string,
): RuntimeCredentials {
  let url: URL;
  let user: string;
  let password: string;
  try {
    const safe = / |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(runtimeUrl)
      ? encodeURI(runtimeUrl).replace(/%25(\d\d)/g, '%$1')
      : runtimeUrl;
    url = new URL(safe);
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    // Вихідну помилку не прокидуємо: її `input` містить рядок із паролем.
    throw fail('не є коректним URL підключення');
  }
  if (user !== RUNTIME_ROLE) return { skip: 'інший користувач' };
  if (!password) return { skip: 'його немає в URL' };
  if (!PASSWORD_ALPHABET.test(password))
    throw fail(
      `пароль ${RUNTIME_ROLE} має складатися лише з друкованих ASCII-символів ` +
        '(пробіл і символи з кодами 0x21–0x7E); змініть пароль ролі й DATABASE_URL',
    );
  return { password };
}

/**
 * Синхронізує пароль `app_runtime` (Е8-О2, Р15). Власник магазину задає один
 * `DATABASE_URL`, а роль канон створює без пароля.
 *
 * 🔴 На сервер іде ВЕРИФІКАТОР SCRAM, не відкритий пароль: інакше пароль
 * лягав би в лог Postgres (`log_statement`, а за замовчуванням і
 * `log_min_error_statement` на будь-якій помилці), у `pg_stat_activity` і
 * `pg_stat_statements`. Помилка запиту перекидається без тексту запиту.
 *
 * @returns чи синхронізовано пароль.
 */
export async function syncRuntimePassword(
  client: pg.ClientBase,
  credentials: RuntimeCredentials,
  log: (line: string) => void,
): Promise<boolean> {
  if ('skip' in credentials) {
    log(
      `[migrate] пароль ${RUNTIME_ROLE} не синхронізовано: ${credentials.skip}`,
    );
    return false;
  }
  const verifier = newScramVerifier(credentials.password);
  try {
    await client.query(
      `alter role ${RUNTIME_ROLE} password ${client.escapeLiteral(verifier)}`,
    );
  } catch (err) {
    // Лише код: повідомлення сервера («at or near …») чи поле `query` обгортки
    // могли б повторити шматок запиту, тобто верифікатор.
    const code = (err as { code?: string }).code ?? 'невідомий';
    throw new Error(
      `[simplycms/migrate] пароль ${RUNTIME_ROLE} не змінено (код ${code})` +
        (HINTS[code] ?? ''),
    );
  }
  log(`[migrate] пароль ${RUNTIME_ROLE} синхронізовано`);
  return true;
}
