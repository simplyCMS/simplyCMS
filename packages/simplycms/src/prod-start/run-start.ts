import { join } from 'node:path';
import { scrubOwnerUrl, STRIPPED_ENV } from './stripped-env';

type Env = Readonly<Record<string, string | undefined>>;

/** Структурний тип накату — `applyMigrations` з `simplycms/migrate` або фейк тесту. */
export type StartMigrate = (options: {
  connectionString: string;
  dir: string;
  runtimeUrl?: string;
  /** Основна мова з конфігу: старт чистої БД створює з неї мову й довідники. */
  primaryLocale: string;
  log: (message: string) => void;
}) => Promise<{
  readonly applied?: readonly string[];
  readonly bootstrapped?: boolean;
} | void>;

/**
 * Усе, що чіпає світ (накат, execve, env, вивід), приходить аргументами: тест
 * ганяє порядок кроків на фейках. Справжню проводку дає `startStore`.
 */
export type StartDeps = {
  env: Env;
  /** Корінь магазину: тут `db/migrations` і `server.mjs`. */
  cwd: string;
  migrate: StartMigrate;
  resolveDriverEnv: (env: Env) => unknown;
  /** Основна мова з `simplycms.config.ts` (`readPrimaryLocale`); `null` — мітки немає, виняток — файл не прочитано. */
  readPrimaryLocale: () => string | null;
  execve:
    | ((file: string, args: string[], env: Record<string, string>) => unknown)
    | undefined;
  log: (message: string) => void;
  execPath?: string;
};

/**
 * Прод-старт (К3-Е8): накат міграцій під паролем власника схеми, далі заміна
 * процесу на `server.mjs` БЕЗ цього пароля в оточенні.
 *
 * @returns у проді не повертається (execve замінює процес); на відмові — код
 *   виходу 1, а `process.exit` лишається викликачу.
 */
export async function runStart({
  env,
  cwd,
  migrate,
  resolveDriverEnv,
  readPrimaryLocale,
  execve,
  log,
  execPath = process.execPath,
}: StartDeps): Promise<number | void> {
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
    // Лише перед накатом: без MIGRATION_DATABASE_URL мова не потрібна (накату немає), а
    // відмова тут закрила б старт магазину, який лише перезапускають.
    let primaryLocale: string | null;
    try {
      primaryLocale = readPrimaryLocale();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      log(`[start] не вдалося прочитати simplycms.config.ts: ${reason}`);
      return 1;
    }
    if (primaryLocale === null) {
      log(
        "[simplycms] У simplycms.config.ts немає primaryLocale: '<код>'. Додайте основну мову магазину.",
      );
      return 1;
    }
    try {
      const report = await migrate({
        connectionString: migrationUrl,
        dir: join(cwd, 'db/migrations'),
        runtimeUrl: env.DATABASE_URL,
        primaryLocale,
        log: (message) => log(scrubOwnerUrl(message, migrationUrl)),
      });
      // Засіяна мова — теж зміна БД: «нічого накочувати» поруч із нею вводило б в оману.
      if (report?.bootstrapped)
        log('[start] засіяно основну мову, довідники й профіль магазину.');
      else if ((report?.applied ?? []).length === 0)
        log('[start] міграції: нічого накочувати.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(
        `[start] накат міграцій не вдався: ${scrubOwnerUrl(message, migrationUrl)}`,
      );
      return 1;
    }
  } else {
    log('[start] MIGRATION_DATABASE_URL не задано — накат пропущено.');
  }

  const serverEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(env))
    if (value !== undefined && !STRIPPED_ENV.includes(key))
      serverEnv[key] = value;
  try {
    execve(execPath, [execPath, join(cwd, 'server.mjs')], serverEnv);
  } catch (error) {
    // EPERM тощо: текст системної помилки без оточення, яке ми передавали.
    const rawCode =
      error && typeof error === 'object' && 'code' in error
        ? error.code
        : undefined;
    // `code` бувають порожні (`undefined`/`null`): рядок «(undefined)» не друкуємо.
    const code =
      typeof rawCode === 'string' || typeof rawCode === 'number'
        ? String(rawCode)
        : undefined;
    log(
      `[start] process.execve не вдався${code ? ` (${code})` : ''}; сервер не запущено.`,
    );
    return 1;
  }
}
