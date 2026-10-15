/**
 * Змінні, яких сервер магазину не бачить: пароль власника схеми потрібен лише
 * накату й не має пережити `execve`.
 *
 * 🔴 Джерело правди — ця константа. Кореневий `server.mjs` тримає літерал-дубль
 * свідомо (Е8-Р7′: раннер фільтрує `.env*` до імпорту бандла й від ядра не
 * залежить); парність розбором самого `server.mjs` стережуть
 * `tests/stripped-env-parity.test.ts` і Gate C пілота (скретч ↔ tarball ядра).
 */
export const STRIPPED_ENV: readonly string[] = ['MIGRATION_DATABASE_URL'];

/** Прибирає з тексту URL власника й його пароль: помилка драйвера може їх цитувати. */
export function scrubOwnerUrl(
  text: string,
  migrationUrl: string | undefined,
): string {
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
