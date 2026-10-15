import type { LocationRewrite } from '@tanstack/react-router';
import { readLocaleSet } from './context';
import { createLocaleRewrite } from './rewrite';
import { NO_LOCALES, type LocaleSet } from './resolve';

/**
 * Мовна частина `createRouter` для `getRouter()` host-а: набір мов (в контекст
 * роутера) і `rewrite`. Стан `rewrite` створюється тут, тобто на роутер:
 * сервер будує роутер на запит, клієнт — один на вкладку (Д3).
 */
export function createRouterLocale(): {
  locales: LocaleSet;
  rewrite: LocationRewrite | undefined;
} {
  const locales = readLocaleSet();
  // Запит без мов (server function, API, медіа): роутер лише контекст, адрес
  // він не розбирає, тож і `rewrite` йому не потрібен.
  if (!locales) return { locales: NO_LOCALES, rewrite: undefined };
  return {
    locales,
    rewrite: createLocaleRewrite(locales, { current: locales.primary }),
  };
}
