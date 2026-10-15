// Відомі фрагменти-заглушки з прикладів env. Єдиний список: його читають і
// `doctor` (error на заглушці), і тест шаблону (`env.example` їх не містить).
// Заглушка «працює» як значення — магазин стартував би з відомим усім секретом,
// тож порожнє значення в шаблоні чесніше за правдоподібне. Для URL це
// підрядок пароля (`your-password` з іншим хостом теж заглушка).

/** @type {Readonly<Record<string, readonly string[]>>} */
export const ENV_PLACEHOLDERS = {
  DATABASE_URL: [':your-password@'],
  BETTER_AUTH_SECRET: ['your-32-byte-random-secret'],
  S3_ACCESS_KEY: ['your-access-key'],
  S3_SECRET_KEY: ['your-secret-key'],
  SMTP_URL: ['user:password@'],
  MIGRATION_DATABASE_URL: ['owner:password@'],
};

/** Ключі, чиє значення містить відомий фрагмент-заглушку (самі значення не повертаються). */
export function placeholderKeys(env) {
  return Object.entries(ENV_PLACEHOLDERS)
    .filter(([key, fragments]) =>
      fragments.some((fragment) => env[key]?.includes(fragment)),
    )
    .map(([key]) => key);
}
