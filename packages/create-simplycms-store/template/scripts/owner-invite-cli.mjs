// CLI-тіло owner:invite: розбір аргументів, перевірка env, код виходу. Окремо від
// ядра (`owner-invite-core.mjs`) і від `owner-invite.mjs`, щоб «`--print-link`
// доходить до ядра» та вимоги env перевірялись юнітом, а не дочірнім процесом
// (пакет `simplycms` у тесті не зібраний).
import { normalizeLocale } from 'simplycms/i18n';
import { runOwnerInvite } from './owner-invite-core.mjs';

/**
 * Локаль листа — з того самого `VITE_LOCALE`, що й `simplycms.config.ts` (одне
 * джерело). Невалідне значення не мовчки стає `uk`: одне попередження.
 */
export function resolveInviteLocale(env, warn) {
  const raw = env.VITE_LOCALE;
  if (!raw) return 'uk';
  const locale = normalizeLocale(raw);
  if (raw.split('-')[0].toLowerCase() !== locale)
    warn(
      `VITE_LOCALE="${raw}" не підтримується — лист запрошення піде мовою "${locale}".`,
    );
  return locale;
}

/**
 * Тіло CLI-обгортки.
 *
 * @returns {Promise<number>} код виходу
 */
export async function runOwnerInviteCli({
  argv,
  env,
  log = (m) => console.log(m),
  error = (m) => console.error(m),
  run = runOwnerInvite,
}) {
  const unknown = argv.filter((arg) => arg !== '--print-link');
  if (unknown.length > 0) {
    error(
      `Невідомий аргумент: ${unknown.join(' ')}. Підтримується лише --print-link.`,
    );
    return 1;
  }
  // 🔴 Р18г: жодної дефолтної адреси — посилання з чужою адресою привело б
  // власника в нікуди (або на чужий хост), а мовчазний фолбек це приховує.
  const missing = ['DATABASE_URL', 'OWNER_EMAIL', 'VITE_SITE_URL'].filter(
    (key) => !env[key],
  );
  if (missing.length > 0) {
    error(
      `Потрібні змінні оточення: ${missing.join(', ')} ` +
        '(env процесу або .env.local магазину).',
    );
    return 1;
  }
  try {
    await run({
      email: env.OWNER_EMAIL,
      siteUrl: env.VITE_SITE_URL,
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
