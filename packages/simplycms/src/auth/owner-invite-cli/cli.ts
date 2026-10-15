import {
  getLanguagePack,
  languageOfConfigLocale,
  type Locale,
} from 'simplycms/i18n';
import { runOwnerInvite } from './run';

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Локаль листа — з того самого `VITE_LOCALE`, що й `simplycms.config.ts` (одне
 * джерело). Невалідне значення не мовчки стає `uk`: одне попередження.
 */
export function resolveInviteLocale(
  env: Env,
  log: (message: string) => void,
): Locale {
  const raw = env.VITE_LOCALE;
  if (!raw) return 'uk';
  const locale = languageOfConfigLocale(raw);
  if (getLanguagePack(locale)) return locale;
  log(
    `VITE_LOCALE="${raw}" не підтримується — лист запрошення піде мовою "uk".`,
  );
  return 'uk';
}

/** Аргументи й обов'язкові ключі env; відмова — помилкою з текстом для оператора. */
function assertUsage(argv: readonly string[], env: Env): void {
  const unknown = argv.filter((arg) => arg !== '--print-link');
  if (unknown.length > 0)
    throw new Error(
      `Невідомий аргумент: ${unknown.join(' ')}. Підтримується лише --print-link.`,
    );
  // 🔴 Р18г: жодної дефолтної адреси — посилання з чужою адресою привело б
  // власника в нікуди (або на чужий хост), а мовчазний фолбек це приховує.
  const missing = ['DATABASE_URL', 'OWNER_EMAIL', 'VITE_SITE_URL'].filter(
    (key) => !env[key],
  );
  if (missing.length > 0)
    throw new Error(
      `Потрібні змінні оточення: ${missing.join(', ')} (env процесу або .env.local магазину).`,
    );
}

export type OwnerInviteCliOptions = {
  argv: readonly string[];
  env: Env;
  log?: (message: string) => void;
  error?: (message: string) => void;
  run?: typeof runOwnerInvite;
};

/**
 * Тіло CLI `owner:invite`: розбір аргументів, перевірка env, код виходу. Окремо
 * від ядра (`runOwnerInvite`), щоб «`--print-link` доходить до ядра» і вимоги
 * env доводились юнітом, а не дочірнім процесом.
 *
 * @returns код виходу
 */
export async function runOwnerInviteCli({
  argv,
  env,
  log = (m) => console.log(m),
  error = (m) => console.error(m),
  run = runOwnerInvite,
}: OwnerInviteCliOptions): Promise<number> {
  try {
    assertUsage(argv, env);
  } catch (e) {
    error(e instanceof Error ? e.message : String(e));
    return 1;
  }
  try {
    await run({
      email: env.OWNER_EMAIL!,
      siteUrl: env.VITE_SITE_URL!,
      storeName: env.VITE_STORE_NAME ?? 'SimplyCMS',
      locale: resolveInviteLocale(env, error),
      printLink: argv.includes('--print-link'),
      env,
      log,
    });
    return 0;
  } catch (e) {
    error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}
