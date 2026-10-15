import { getStorefrontRoot } from '../server/root';
import type { StorefrontRootData } from '../head/head';
import { resolveRequestLocale, type LocaleSet } from './resolve';

/**
 * Мова сторінки з публічного href роутера (`location.publicHref`: шлях + query +
 * hash з префіксом мови, ДО `rewrite`). Це та сама `resolveRequestLocale`, що в
 * інтерсепторі й `rewrite`, — лише з витягнутим шляхом.
 */
export function localeOfHref(publicHref: string, locales: LocaleSet): string {
  const { pathname } = new URL(publicHref, 'http://localhost');
  return resolveRequestLocale(pathname, locales).locale;
}

/**
 * Дані кореня вітрини для лоадера `__root.tsx`: те, що віддає серверний
 * `getStorefrontRoot`, плюс мова сторінки й набір опублікованих мов (для
 * `<html lang>`, `window.__SCMS_LOCALES__` і майбутніх hreflang).
 *
 * Набір мов приходить з контексту роутера, а не з ALS: лоадер на клієнті не
 * має серверного контексту, а на сервері не повинен залежати від нього.
 */
export async function loadStorefrontRoot(
  publicHref: string,
  locales: LocaleSet,
): Promise<StorefrontRootData> {
  if (locales.primary === '') {
    throw new Error(
      'simplycms: the root loader ran without a storefront locale set — the ' +
        'host server entry (src/server.ts) must wrap its handler in withStorefrontNormalize',
    );
  }
  return {
    ...(await getStorefrontRoot()),
    locale: localeOfHref(publicHref, locales),
    languages: { primary: locales.primary, published: locales.published },
  };
}
