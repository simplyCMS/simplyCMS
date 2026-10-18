import type pg from 'pg';
import { newScramVerifier, scramSha256Verifier } from './scram';

/** Роль, якою застосунок конектиться в рантаймі (`0000_prelude.sql`). */
const RUNTIME_ROLE = 'app_runtime';

/**
 * Друкований ASCII: для нього SASLprep тотожний, тож верифікатор, порахований
 * тут, і логін через libpq чи node-postgres сходяться. Для решти символів
 * libpq нормалізує пароль SASLprep, а node-postgres — ні; SASLprep не робимо.
 */
const PASSWORD_ALPHABET = /^[\x20-\x7e]+$/;

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
  if (await alreadySet(client, credentials.password)) {
    log(`[migrate] пароль ${RUNTIME_ROLE} уже синхронізовано`);
    return true;
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
      `[simplycms/migrate] пароль ${RUNTIME_ROLE} не змінено (код ${code}); ` +
        "з'єднання накату мусить мати право ALTER ROLE",
    );
  }
  log(`[migrate] пароль ${RUNTIME_ROLE} синхронізовано`);
  return true;
}

/** `SCRAM-SHA-256$<iter>:<salt>$<StoredKey>:<ServerKey>` → сіль і ітерації (інше — `null`). */
const SCRAM = /^SCRAM-SHA-256\$(\d+):([^$]+)\$/;

/**
 * Чи пароль `app_runtime` уже той самий: верифікатор із ТІЄЮ САМОЮ сіллю й ітераціями, що лежить
 * у `pg_authid`, збігається з нашим. Тоді `alter role` не потрібен — і не пишеться: рядок ролі
 * живе в спільному каталозі кластера, а безумовний запис щоразу (верифікатор із випадковою сіллю)
 * при паралельних накатах на різні БД давав `tuple concurrently updated`. `pg_authid` читає лише
 * суперкористувач: без права — `false` (запис, як раніше). Пароль у запит не йде.
 */
async function alreadySet(
  client: pg.ClientBase,
  password: string,
): Promise<boolean> {
  const can = await client.query<{ ok: boolean }>(
    "select has_table_privilege('pg_catalog.pg_authid', 'select') as ok",
  );
  if (!can.rows[0]?.ok) return false;
  const res = await client.query<{ pw: string | null }>(
    'select rolpassword as pw from pg_catalog.pg_authid where rolname = $1',
    [RUNTIME_ROLE],
  );
  const stored = res.rows[0]?.pw ?? '';
  const m = SCRAM.exec(stored);
  if (!m) return false;
  return (
    scramSha256Verifier(
      password,
      Buffer.from(m[2]!, 'base64'),
      Number(m[1]),
    ) === stored
  );
}
