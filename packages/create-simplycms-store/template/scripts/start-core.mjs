// Ядро прод-старту магазину: накат міграцій під паролем власника схеми, далі
// заміна процесу на сервер БЕЗ цього пароля в оточенні (К3-Е8, Е8-Р6).
//
// Чистий модуль з ін'єкцією (за зразком owner-invite-core.mjs): усе, що чіпає
// світ (міграції, execve, env, вивід), приходить аргументами, тож тест
// ганяє порядок кроків на фейках. Тонка обгортка — `start.mjs`.
import { join } from 'node:path';

/**
 * Змінні, яких сервер не бачить. Дубль списку є в кореневому `server.mjs`
 * (там вони не підтягуються з `.env*`); парність стереже `tests/start-core.test.ts`.
 */
export const STRIPPED_ENV = ['MIGRATION_DATABASE_URL'];

/** Прибирає з тексту URL власника й його пароль: помилка драйвера може їх цитувати. */
function scrub(text, migrationUrl) {
  let out = text;
  if (!migrationUrl) return out;
  out = out.split(migrationUrl).join('[MIGRATION_DATABASE_URL]');
  try {
    const { password } = new URL(migrationUrl);
    if (password) {
      for (const variant of new Set([password, decodeURIComponent(password)]))
        if (variant) out = out.split(variant).join('***');
    }
  } catch {
    // Некоректний URL — вище вже замінено його цілком.
  }
  return out;
}

/**
 * @param {{
 *   env: Record<string, string | undefined>;
 *   cwd: string;
 *   migrate: (options: {
 *     connectionString: string;
 *     dir: string;
 *     runtimeUrl?: string;
 *     log: (message: string) => void;
 *   }) => Promise<{ applied?: string[] } | void>;
 *   resolveDriverEnv: (env: Record<string, string | undefined>) => { warnings: readonly string[] };
 *   execve: ((file: string, args: string[], env: Record<string, string>) => unknown) | undefined;
 *   log: (message: string) => void;
 *   execPath?: string;
 * }} deps
 * @returns {Promise<number | void>} у проді не повертається (execve замінює
 *   процес); на відмові повертає код виходу 1 — виклик `process.exit` лишається
 *   обгортці.
 */
export async function runStart({
  env,
  cwd,
  migrate,
  resolveDriverEnv,
  execve,
  log,
  execPath = process.execPath,
}) {
  // Спершу env: часткова група має зупинити старт ДО накату, а не після.
  try {
    // Лише щоб упасти до накату; попередження друкує серверний бандл (один раз).
    resolveDriverEnv(env);
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    return 1;
  }

  // Без execve пароль власника лишився б у процесі сервера; фолбеку немає.
  if (typeof execve !== 'function') {
    log(
      '[start] потрібен Node ≥ 24 (process.execve); стартова команда — `node scripts/start.mjs`.',
    );
    return 1;
  }

  const migrationUrl = env.MIGRATION_DATABASE_URL;
  if (migrationUrl) {
    try {
      const report = await migrate({
        connectionString: migrationUrl,
        dir: join(cwd, 'db/migrations'),
        runtimeUrl: env.DATABASE_URL,
        log: (message) => log(scrub(message, migrationUrl)),
      });
      if ((report?.applied ?? []).length === 0)
        log('[start] міграції: нічого накочувати.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`[start] накат міграцій не вдався: ${scrub(message, migrationUrl)}`);
      return 1;
    }
  } else {
    log('[start] MIGRATION_DATABASE_URL не задано — накат пропущено.');
  }

  const serverEnv = Object.fromEntries(
    Object.entries(env).filter(
      ([key, value]) => value !== undefined && !STRIPPED_ENV.includes(key),
    ),
  );
  try {
    execve(execPath, [execPath, join(cwd, 'server.mjs')], serverEnv);
  } catch (error) {
    // EPERM тощо: текст системної помилки без оточення, яке ми передавали.
    const code = error && typeof error === 'object' ? error.code : undefined;
    log(
      `[start] process.execve не вдався${code ? ` (${code})` : ''}; сервер не запущено.`,
    );
    return 1;
  }
}
