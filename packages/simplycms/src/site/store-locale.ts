import {
  loadTranslator,
  toUiLocale,
  type Translator,
  type UiLocale,
} from 'simplycms/i18n';

/**
 * Мова ІНТЕРФЕЙСУ листів і серверних текстів, про яку серверу повідомляє host
 * (`src/server.ts`, тим самим каналом, що `declareBuiltThemes`). Серверний код
 * не має доступу до `simplycms.config` — він живе лише в збірці магазину.
 */
let storeLocale: UiLocale | null = null;
let warned = false;

/**
 * Кінцева ланка fallback листів: каталог `uk`.
 * Тимчасовий міст, не публічний контракт; зноситься в Task 6 (замість нього —
 * основна мова магазину через `resolveMailUiLocale`).
 */
// М2а-TEMP: Task 6
export const STORE_UI_FALLBACK: UiLocale = (() => {
  const uk = toUiLocale('uk');
  if (!uk) throw new Error('simplycms/site: у ядрі немає мовного пакета uk');
  return uk;
})();

/**
 * Задати мову листів із тегу конфігу; повторний виклик ЗАМІНЮЄ її. Тег без точного
 * пакета (`fr`) лишає інтерфейс листів на `uk`, а не падає на старті сервера.
 */
export function declareStoreLocale(tag: string): void {
  storeLocale = toUiLocale(tag) ?? STORE_UI_FALLBACK;
}

/**
 * Незадекларована мова — не падіння (лист скидання важливіший за мову), а
 * дефолт ядра `uk` з ОДНИМ попередженням на процес: інакше власник англомовного
 * магазину мовчки отримував би українські листи.
 */
export function getStoreLocale(): UiLocale {
  if (storeLocale) return storeLocale;
  if (!warned) {
    warned = true;
    console.warn(
      '[simplycms/site] Локаль магазину не задекларована (declareStoreLocale ' +
        'у src/server.ts) — листи йдуть українською.',
    );
  }
  return STORE_UI_FALLBACK;
}

/**
 * Транслятор листів магазину: частини `base` і `mail` мови (за замовчуванням — мови
 * магазину). Каталоги ядра повні для кожної мови, тож fallback-мови немає. Єдине місце, де
 * листи й CLI вантажать каталоги (частини ледачі): викликачі лише `await`.
 * Тимчасовий міст, не публічний контракт; зноситься в Task 6.
 */
// М2а-TEMP: Task 6
export function getStoreTranslator(
  locale: UiLocale = getStoreLocale(),
): Promise<Translator> {
  return loadTranslator(locale, ['base', 'mail']);
}

/** Скидає стан (teardown тестів). */
export function resetStoreLocale(): void {
  storeLocale = null;
  warned = false;
}
