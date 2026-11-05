import type { UiLocale } from 'simplycms/contracts';
import type { CatalogValue, FoundForms, MessageParams } from './types';

/** Каталог для пошуку: будь-яка частина ядра, каталог теми чи плагіна. */
export type LookupCatalog = Readonly<Record<string, CatalogValue>>;

/**
 * Підстановка `{name}` значеннями з `params`; невідомий плейсхолдер лишається як є.
 * Живе поруч із `lookupMessage` (їх разом кличуть транслятор, `useThemeT`, `usePluginT`):
 * одне форматування, одне джерело правди.
 */
export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Єдиний ланцюг пошуку повідомлення: перший каталог, що має ключ, → підстановка `{name}`;
 * ключа немає ніде — сам ключ (видимий сигнал про пропущений переклад, а не мовчазний
 * рядок чужою мовою). Каталоги подаються в порядку пріоритету: власна мова, далі основна.
 *
 * Спільний для транслятора ядра, `useThemeT` і `usePluginT` (І42): раніше кожен мав власну
 * копію `a?.[k] ?? b?.[k] ?? k`, і порядок міг розійтися непоміченим.
 */
export function lookupMessage(
  catalogs: readonly (LookupCatalog | undefined)[],
  key: string,
  params?: MessageParams,
): string {
  for (const catalog of catalogs) {
    const template = catalog?.[key];
    // Ключ-множина через `t()` — помилка виклику: значення-об'єкт не рядок, тож ключ
    // вважається відсутнім (видимий сигнал), а форми віддає лише `lookupForms`.
    if (typeof template === 'string') return interpolate(template, params);
  }
  return key;
}

/** Ланка ланцюга каталогів: сам каталог і мова, якою він написаний. */
export interface CatalogLink {
  readonly locale: UiLocale;
  readonly catalog: LookupCatalog | undefined;
}

/**
 * Форми множини ключа з першої ланки, що має його значенням-об'єктом, разом з мовою цієї
 * ланки (за її правилами `plural` вибирає категорію). Порядок ланок той самий, що в
 * `lookupMessage` (власна мова, далі основна).
 */
export function lookupForms(
  chain: readonly CatalogLink[],
  key: string,
): FoundForms | undefined {
  for (const { locale, catalog } of chain) {
    const value = catalog?.[key];
    if (typeof value === 'object') return { forms: value, locale };
  }
  return undefined;
}
