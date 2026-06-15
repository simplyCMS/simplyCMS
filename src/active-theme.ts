/**
 * Передача назви активної теми із сервера на клієнт ДО гідрації.
 *
 * Сервер серіалізує назву в інлайн-скрипт (`<head>`), який виконується під час
 * парсингу HTML — раніше за відкладений модуль `client.tsx`. Завдяки цьому
 * клієнт встигає прогріти кеш саме активної теми перед `hydrateRoot`, і
 * route-компоненти не суспендяться на `use(ThemeRegistry.load(...))`.
 */

/** Ключ у `window`, під яким лежить назва активної теми */
export const ACTIVE_THEME_GLOBAL = '__SIMPLYCMS_ACTIVE_THEME__';

/** Згенерувати тіло інлайн-скрипта, що записує назву теми у `window` */
export function serializeActiveThemeScript(themeName: string): string {
  return `window[${JSON.stringify(ACTIVE_THEME_GLOBAL)}]=${JSON.stringify(themeName)}`;
}

/** Прочитати назву активної теми, прокинуту сервером (клієнт) */
export function readActiveThemeName(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as Record<string, unknown>)[ACTIVE_THEME_GLOBAL] as
    | string
    | undefined;
}
