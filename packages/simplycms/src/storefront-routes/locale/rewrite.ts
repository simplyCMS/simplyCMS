import type { LocationRewrite } from '@tanstack/react-router';
import {
  isStorefrontPath,
  localePrefix,
  resolveRequestLocale,
  type LocaleSet,
} from './resolve';

/** Мова поточного роутера: `input` пише, `output` читає (Д3). */
export type LocaleRewriteState = { current: string };

/**
 * `rewrite` роутера: URL із префіксом мови ↔ внутрішній шлях без нього, тож
 * дерево роутів лишається одним і тим самим для всіх мов.
 *
 * `state` створюється в `getRouter()` і живе стільки, скільки роутер: на
 * сервері роутер народжується на запит, на клієнті він один. Це не друге
 * джерело мови, а обчислене `resolveRequestLocale` значення, яке `output`
 * мусить знати, бо будує посилання без URL запиту. Мова змінюється лише
 * повним завантаженням (інший префікс = інший документ), тож стан не
 * розходиться з адресним рядком.
 *
 * Адмінка, API, server functions, статика й медіа проходять без змін в обидва
 * боки (умова архітектора 3). Слеша `output` не додає й не знімає: канонічний
 * шлях роутера (`trailingSlash: 'never'`) віддає саме нормалізація.
 */
export function createLocaleRewrite(
  set: LocaleSet,
  state: LocaleRewriteState,
): LocationRewrite {
  return {
    input: ({ url }) => {
      if (!isStorefrontPath(url.pathname)) return undefined;
      const resolved = resolveRequestLocale(url.pathname, set);
      state.current = resolved.locale;
      if (!resolved.prefixed) return undefined;
      // Префікс мови над невітринним шляхом не знімаємо: `/en/api/health` не
      // має стати дублем `/api/health` — роутер дасть 404.
      if (!isStorefrontPath(resolved.rest)) return undefined;
      url.pathname = resolved.rest;
      return url;
    },
    output: ({ url }) => {
      if (!isStorefrontPath(url.pathname)) return undefined;
      if (state.current === set.primary) return undefined;
      const prefix = `/${localePrefix(state.current)}`;
      url.pathname = url.pathname === '/' ? prefix : prefix + url.pathname;
      return url;
    },
  };
}
