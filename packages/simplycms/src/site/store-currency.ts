/**
 * Валюта магазину для листів: серверний код не бачить `simplycms.config`, тож
 * host повідомляє її тим самим каналом, що й локаль (`declareStoreLocale`,
 * `src/server.ts`). Чек без валюти двозначний.
 */
const DEFAULT_CURRENCY = 'UAH';
let storeCurrency: string | null = null;
let warned = false;

/** Задати валюту (ISO-код); повторний виклик ЗАМІНЮЄ її. */
export function declareStoreCurrency(currency: string): void {
  storeCurrency = currency;
}

/**
 * Незадекларована валюта — не падіння, а дефолт ядра з ОДНИМ попередженням на
 * процес (як `getStoreLocale`): інакше магазин не в гривні мовчки отримував би
 * суми з «₴».
 */
export function getStoreCurrency(): string {
  if (storeCurrency) return storeCurrency;
  if (!warned) {
    warned = true;
    console.warn(
      '[simplycms/site] Валюта магазину не задекларована (declareStoreCurrency ' +
        `у src/server.ts) — у листах ${DEFAULT_CURRENCY}.`,
    );
  }
  return DEFAULT_CURRENCY;
}

/** Скидає стан (teardown тестів). */
export function resetStoreCurrency(): void {
  storeCurrency = null;
  warned = false;
}
