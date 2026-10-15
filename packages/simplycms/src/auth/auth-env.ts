/**
 * Контракт серверного env для auth-контуру (спека CLI v1 §7, Task 7).
 *
 * 🔴 Ключі читаються ЛИШЕ з `process.env` і ЛИШЕ в рантаймі — усередині
 * фабрики інстансу, не на модуль-рівні. `VITE_`-префікса тут немає й бути не
 * може: секрет підпису сесій у клієнтському бандлі — це вже не секрет.
 * Наслідок той самий, що й у `db/client`: ротація секрету = перезапуск
 * процесу, без перезбірки.
 *
 * Функції винесено з `./instance` навмисно: так контракт env перевіряється
 * юнітом без інстансу Better Auth і без БД.
 */

import { siteUrl } from 'simplycms/env';

/** Джерело змінних оточення (та сама форма, що в `db/client`). */
export interface AuthEnv {
  readonly BETTER_AUTH_SECRET?: string;
  readonly BETTER_AUTH_URL?: string;
  readonly VITE_SITE_URL?: string;
}

/**
 * Секрет підпису сесій і токенів.
 *
 * @throws Error якщо ключ відсутній або порожній — тихий фолбек на
 * згенерований секрет зробив би всі сесії недійсними після кожного
 * перезапуску, і діагноз виглядав би як «випадкові розлогіни».
 */
export function resolveAuthSecret(env: AuthEnv): string {
  // `||`, а не `??`: оголошена-але-порожня змінна — це відсутній ключ.
  const secret = env.BETTER_AUTH_SECRET || undefined;

  if (!secret) {
    throw new Error(
      '[simplycms/auth] Відсутня змінна оточення BETTER_AUTH_SECRET — нема ' +
        'чим підписувати сесії (лише process.env, лише в рантаймі, спека CLI v1 §7).',
    );
  }

  return secret;
}

/**
 * Перевіряє, що база посилань — коректна абсолютна адреса, і повертає її без змін.
 *
 * 🔴 Без цього зіпсоване значення давало б голу `TypeError: Invalid URL` у
 * `new URL(...)` без імені ключа. Помилка називає ключ, але не значення:
 * у `BETTER_AUTH_URL` може лежати що завгодно.
 *
 * @param key імʼя ключа env (або поля `AuthDeps`) для повідомлення
 */
export function assertAuthBaseUrl(value: string, key: string): string {
  let protocol: string | undefined;
  try {
    protocol = new URL(value).protocol;
  } catch {
    // нижче: та сама відмова, що й для чужої схеми
  }
  // `foo:bar` парситься як URL, але origin у нього непрозорий (`null`) — база
  // посилань і trustedOrigins були б зламані мовчки.
  if (protocol !== 'http:' && protocol !== 'https:')
    throw new Error(
      `[simplycms/auth] ${key} не є коректною абсолютною адресою з протоколом ` +
        'http: або https: — база посилань не може бути порожньою, відносною чи чужою схемою.',
    );
  return value;
}

/**
 * Публічна база URL застосунку: колбеки і посилання в листах (скидання пароля).
 *
 * 🔴 Р18а: `BETTER_AUTH_URL` (явний override) або ORIGIN із `VITE_SITE_URL` — той
 * самий origin, що й у `siteUrl()` (шлях `VITE_SITE_URL` ігнорується, обидві бази
 * не розходяться). Без бази Better Auth взяв би її (і `trustedOrigins`) із
 * `request.url`, тобто з підробного `Host`/`X-Forwarded-Host`, — тому відсутність
 * обох ключів ПАДАЄ гучно, як відсутній секрет, а не мовчки відкриває S3-01.
 *
 * @throws Error якщо немає ні `BETTER_AUTH_URL`, ні `VITE_SITE_URL`, або
 * `BETTER_AUTH_URL` не є абсолютною адресою.
 */
export function resolveAuthBaseUrl(env: AuthEnv): string {
  const explicit = env.BETTER_AUTH_URL || undefined;
  if (explicit) return assertAuthBaseUrl(explicit, 'BETTER_AUTH_URL');
  if (!env.VITE_SITE_URL) {
    throw new Error(
      '[simplycms/auth] Відсутні BETTER_AUTH_URL і VITE_SITE_URL — нема з чого ' +
        'будувати базу посилань (без неї вона береться із запиту).',
    );
  }
  return new URL(siteUrl('/', { VITE_SITE_URL: env.VITE_SITE_URL })).origin;
}
