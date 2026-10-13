// Чисті будівники онлайн-перевірок стану БД магазину — спільні для `doctor --online`
// (doctor-db-checks.mjs) і `status` (status-online.mjs). Без I/O: читання робить ядро.
import { redactUrls } from './redact-urls.mjs';

export const JOURNAL = 'Журнал міграцій';

export const check = (id, title, status, details) => ({
  id,
  title,
  status,
  details,
});

/** Текст помилки без облікових даних з URL. */
export const reason = (error) =>
  redactUrls(error instanceof Error ? error.message : String(error));

/** Рядок журналу за станом: немає / розбіжність сум / ненакочені / гаразд. */
export function journalCheck(rows, files, core) {
  if (rows === null)
    return check(
      'migrations-journal',
      JOURNAL,
      'error',
      'база без журналу (public.simplycms_migrations): накоти схему — pnpm simplycms db:apply',
    );
  const { pending, changed } = core.pendingMigrations(rows, files);
  if (changed.length > 0)
    return check(
      'migrations-journal',
      JOURNAL,
      'error',
      `накочені файли змінено: ${changed.join(', ')} — застосований файл не правиться, зміна йде новою міграцією`,
    );
  if (pending.length > 0)
    return check(
      'migrations-journal',
      JOURNAL,
      'warn',
      `ненакочені міграції (${pending.length}): ${pending.join(', ')} — pnpm simplycms db:apply`,
    );
  return check('migrations-journal', JOURNAL, 'ok');
}

const OWNER = 'Власник магазину';
const PROFILE = 'Профіль магазину';
const MAIL = 'Черга листів';

/**
 * Перевірки наповнення: власник, профіль, невдалі листи. Усе `warn`, не `error`: у
 * щойно створеному магазині власника й email ще немає — це крок онбордингу, а не
 * поломка (`error` перехопив би наступний скіл у `diagnose`).
 * @param {{ owners: number, profile: { name: string, email: string | null } | null, failedMail: number }} facts
 */
export function storeFactChecks({ owners, profile, failedMail }) {
  const problems = [];
  if (profile === null || profile.name === '')
    problems.push(
      'назву магазину не задано (адмінка → Налаштування → Профіль)',
    );
  if (profile === null || profile.email === null)
    problems.push(
      'email у контактах порожній: листи власнику про замовлення не надходитимуть',
    );
  return [
    owners > 0
      ? check('store-owner', OWNER, 'ok')
      : check(
          'store-owner',
          OWNER,
          'warn',
          'жодного користувача з роллю admin — створи власника: pnpm owner:invite',
        ),
    problems.length === 0
      ? check('store-profile', PROFILE, 'ok')
      : check('store-profile', PROFILE, 'warn', problems.join('; ')),
    failedMail === 0
      ? check('mail-outbox', MAIL, 'ok')
      : check(
          'mail-outbox',
          MAIL,
          'warn',
          `недоставлених листів: ${failedMail} — адмінка → картка листів → «Повторити»`,
        ),
  ];
}
