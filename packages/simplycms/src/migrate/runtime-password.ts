import type pg from 'pg';

/** Роль, якою застосунок конектиться в рантаймі (`0000_prelude.sql`). */
const RUNTIME_ROLE = 'app_runtime';

/**
 * Синхронізує пароль `app_runtime` з паролем у `runtimeUrl` (Е8-О2).
 * Власник магазину задає один `DATABASE_URL`, а роль створює канон без
 * пароля, — без синку застосунок не залогінився б на кластері з
 * парольною автентифікацією.
 *
 * Лише якщо користувач URL — саме `app_runtime`: чужу роль (наприклад,
 * власника в dev-налаштуванні) накат не чіпає.
 *
 * 🔴 Пароль не потрапляє ні в лог, ні в текст помилки. `ALTER ROLE` не
 * приймає параметрів, тому літерал екранує драйвер.
 *
 * @returns чи синхронізовано пароль.
 */
export async function syncRuntimePassword(
  client: pg.ClientBase,
  runtimeUrl: string,
  log: (line: string) => void,
): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(runtimeUrl);
  } catch {
    // Вихідну помилку не прокидуємо: її `input` містить рядок із паролем.
    throw new Error(
      '[simplycms/migrate] runtimeUrl не є коректним URL підключення',
    );
  }
  if (decodeURIComponent(url.username) !== RUNTIME_ROLE) {
    log(`[migrate] пароль ${RUNTIME_ROLE} не синхронізовано: інший користувач`);
    return false;
  }
  const password = decodeURIComponent(url.password);
  if (!password) {
    log(`[migrate] пароль ${RUNTIME_ROLE} не синхронізовано: його немає в URL`);
    return false;
  }
  await client.query(
    `alter role ${RUNTIME_ROLE} password ${client.escapeLiteral(password)}`,
  );
  log(`[migrate] пароль ${RUNTIME_ROLE} синхронізовано`);
  return true;
}
