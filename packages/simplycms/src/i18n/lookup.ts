import type { MessageParams } from './types';

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
  catalogs: readonly (Readonly<Record<string, string>> | undefined)[],
  key: string,
  params?: MessageParams,
): string {
  for (const catalog of catalogs) {
    const template = catalog?.[key];
    if (template !== undefined) return interpolate(template, params);
  }
  return key;
}
