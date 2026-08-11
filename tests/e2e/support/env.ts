/**
 * Оточення, яке `scripts/e2e.mjs` виставляє ПЕРЕД запуском `playwright test`
 * (порт dev-сервера, локаль, креденшели власника-адміна).
 *
 * 🔴 Без оркестратора цих змінних немає — прямий `npx playwright test`
 * (в обхід `pnpm test:e2e`) має падати зрозумілою помилкою тут, а не
 * заплутаним `undefined` десь усередині селектора чи `baseURL`.
 */

export type Locale = 'uk-UA' | 'en-US';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} не задано — e2e-специ запускаються ЛИШЕ через ` +
        '`pnpm test:e2e` (scripts/e2e.mjs готує оточення), не напряму через playwright.',
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
