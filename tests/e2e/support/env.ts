/**
 * Оточення, яке оркестратор e2e виставляє ПЕРЕД запуском `playwright test`
 * (порт dev-сервера, локаль, креденшели власника-адміна).
 *
 * 🔴 Оркестратора зараз НЕМАЄ: `scripts/e2e.mjs` знесено разом із локальним
 * стеком Supabase, новий (Postgres + Better Auth) повертає контур К6. Тому
 * прямий `npx playwright test` падає зрозумілою помилкою тут, а не
 * заплутаним `undefined` десь усередині селектора чи `baseURL`.
 */

export type Locale = 'uk-UA' | 'en-US';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} не задано — e2e-специ потребують оркестратора, який готує ` +
        'оточення. Його знесено разом зі стеком Supabase; новий повертає ' +
        'контур К6, до того часу прогін специв не підтримується.',
    );
  }
  return value;
}

/** Активна локаль прогону — та сама змінна, яку читає `simplycms.config.ts`. */
export function e2eLocale(): Locale {
  const raw = process.env.VITE_LOCALE ?? 'uk-UA';
  if (raw !== 'uk-UA' && raw !== 'en-US') {
    throw new Error(`Невідома VITE_LOCALE=${raw} (очікую uk-UA або en-US).`);
  }
  return raw;
}

/** Порт dev-сервера, піднятого `webServer` із `playwright.config.ts`. */
export function e2ePort(): number {
  return Number(required('E2E_PORT'));
}

/** Креденшели власника-адміна, забутстрапленого `scripts/e2e/bootstrap-owner.mjs`. */
export function ownerCredentials(): { email: string; password: string } {
  return {
    email: required('E2E_OWNER_EMAIL'),
    password: required('E2E_OWNER_PASSWORD'),
  };
}
