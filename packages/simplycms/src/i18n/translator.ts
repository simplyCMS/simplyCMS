import { lookupForms, lookupMessage, type CatalogLink } from './lookup';
import type { UiLocale } from 'simplycms/contracts';
import type {
  MessageParams,
  PartCatalog,
  PluralTranslator,
  Translator,
} from './types';

/**
 * Збирає транслятор над ланцюгом каталогів у порядку пріоритету (кожна ланка — каталог і
 * його мова). Єдина фабрика для ядра, теми й
 * плагіна (`useThemeT`, `usePluginT`): транслятор будь-якого рівня має ту саму форму
 * (функція + `locale` + `forms`), тож `plural` працює з усіма однаково.
 */
export function createLookupTranslator<S extends string, P extends string>(
  chain: readonly CatalogLink[],
  locale: UiLocale,
): PluralTranslator<S, P> {
  const catalogs = chain.map((link) => link.catalog);
  const t = (key: S, params?: MessageParams): string =>
    lookupMessage(catalogs, key, params);
  return Object.assign(t, {
    locale,
    forms: (key: P) => lookupForms(chain, key),
  });
}

/**
 * Створює транслятор над УЖЕ завантаженими частинами каталогу (завантаження — реєстр
 * `loadUiCatalog`, тут чиста синхронна функція). `locale` — мова інтерфейсу цих частин:
 * за нею `plural` вибирає категорію множини.
 *
 * Ланцюг (`lookupMessage`): перший каталог, що має ключ → сам ключ (видимий сигнал про
 * пропущений переклад). Каталоги ядра повні для кожної мови (англійські частини
 * `satisfies ShapeOf<uk>`), тож fallback-мови тут немає: вона потрібна лише каталогам
 * теми й плагіна, які можуть бути неповними (`useThemeT`).
 *
 * Транслятор — замикання без модульного mutable-стану: жодного `setLocale`. Тому SSR може
 * тримати кілька трансляторів різних мов одночасно (per-request).
 */
export function createTranslator(
  catalogs: readonly PartCatalog[],
  locale: UiLocale,
): Translator {
  // Каталоги ядра повні й однієї мови — кожна ланка несе мову інтерфейсу.
  return createLookupTranslator(
    catalogs.map((catalog) => ({ locale, catalog })),
    locale,
  );
}
