/**
 * Контракт серверного env для auth-контуру (спека CLI v1 §7, Task 7).
 *
 * 🔴 Ключі читаються ЛИШЕ з `process.env` і ЛИШЕ в рантаймі — усередині
 * фабрики інстансу, не на модуль-рівні. `VITE_`-префікса тут немає й бути не
 * може: секрет підпису сесій у клієнтському бандлі — це вже не секрет.
 * Наслідок той самий, що й у Supabase-фабрик: ротація секрету = перезапуск
 * процесу, без перезбірки.
 *
 * Функції винесено з `./instance` навмисно: так контракт env перевіряється
 * юнітом без інстансу Better Auth і без БД.
 */

/** Джерело змінних оточення (та сама форма, що в `db/client` і `supabase/keys`). */
export interface AuthEnv {
  readonly BETTER_AUTH_SECRET?: string;
  readonly BETTER_AUTH_URL?: string;
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
      '[simplycms/auth] Відсутня змінна оточення BETTER_AUTH_SECRET — ' +
        'нема чим підписувати сесії. Контракт серверного env — спека CLI v1 ' +
        '§7 (лише process.env, лише в рантаймі).',
    );
  }

  return secret;
}

/**
 * Публічна база URL застосунку (потрібна для колбеків OAuth і посилань у
 * листах). Опційна: без неї Better Auth виводить базу з самого запиту, чого
 * достатньо для email/password-флоу.
 */
export const resolveAuthBaseUrl = (env: AuthEnv): string | undefined =>
  env.BETTER_AUTH_URL || undefined;
