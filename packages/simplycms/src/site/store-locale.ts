import type { Locale } from 'simplycms/i18n';

/**
 * Локаль листів і серверних текстів, про яку серверу повідомляє host
 * (`src/server.ts`, тим самим каналом, що `declareBuiltThemes`). Серверний код
 * не має доступу до `simplycms.config` — він живе лише в збірці магазину.
 */
let storeLocale: Locale | null = null;
let warned = false;

/** Задати локаль; повторний виклик ЗАМІНЮЄ її. */
export function declareStoreLocale(locale: Locale): void {
  storeLocale = locale;
}

/**
 * Незадекларована локаль — не падіння (лист скидання важливіший за мову), а
 * дефолт ядра `uk` з ОДНИМ попередженням на процес: інакше власник англомовного
 * магазину мовчки отримував би українські листи.
 */
export function getStoreLocale(): Locale {
  if (storeLocale) return storeLocale;
  if (!warned) {
    warned = true;
    console.warn(
      '[simplycms/site] Локаль магазину не задекларована (declareStoreLocale ' +
        'у src/server.ts) — листи йдуть українською.',
    );
  }
  return 'uk';
}

/** Скидає стан (teardown тестів). */
export function resetStoreLocale(): void {
  storeLocale = null;
  warned = false;
}
