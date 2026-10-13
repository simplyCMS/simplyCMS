// Відомі значення-заглушки з прикладів env. Єдиний список: його читають і
// `doctor` (error на заглушці), і тест шаблону (`env.example` їх не містить).
// Заглушка «працює» як значення — магазин стартував би з відомим усім секретом,
// тож порожнє значення в шаблоні чесніше за правдоподібне.

/** @type {Readonly<Record<string, readonly string[]>>} */
export const ENV_PLACEHOLDERS = {
  DATABASE_URL: [
    'postgresql://app_runtime:your-password@localhost:5432/postgres',
  ],
  BETTER_AUTH_SECRET: ['your-32-byte-random-secret'],
  S3_ACCESS_KEY: ['your-access-key'],
  S3_SECRET_KEY: ['your-secret-key'],
  SMTP_URL: ['smtps://user:password@smtp.example.com:465'],
  MIGRATION_DATABASE_URL: [
    'postgresql://owner:password@localhost:5432/postgres',
  ],
};

/** Ключі, чиє значення в `env` дорівнює відомій заглушці (самі значення не повертаються). */
export function placeholderKeys(env) {
  return Object.entries(ENV_PLACEHOLDERS)
    .filter(([key, values]) => values.includes(env[key]))
    .map(([key]) => key);
}
