import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestContext } from 'simplycms/site/request-context';
import { loadLocaleSet } from 'simplycms/storefront/loaders';
import type { LocaleSet } from './resolve';
import { readClientLocaleSet } from './script';

/**
 * Набір мов запиту: ізоморфно, з ОДНОГО місця, звідки його читає все інше.
 *
 * Сервер бере набір із контексту запиту, який виставила нормалізація
 * (`withStorefrontNormalize`) — тобто з кешу мов з поколіннями, а не з
 * процесного стану; `undefined` означає запит без мов (server function, API,
 * медіа: Start створює для них роутер, але сторінки не рендерить). Клієнт — з
 * `window.__SCMS_LOCALES__`, який той самий набір записав у `<head>`. Серверну
 * половину компілятор Start прибирає з клієнтського бандла разом із
 * server-only імпортом `site`.
 *
 * Читати це треба ОДИН раз — у `getRouter()`; далі набір їде в контексті
 * роутера (`context.locales`), і ні лоадер, ні `NotFound` до ALS не звертаються.
 * Виняток — запит, який нормалізація не готувала (404 під `/api`, адмінка): для
 * нього `undefined` тут, а `beforeLoad` кореня дочитує набір
 * (`loadLocaleSetLazily`, див. `resolveRouterLocales`).
 */
export const readLocaleSet = createIsomorphicFn()
  .server((): LocaleSet | undefined => getRequestContext()?.storefront?.locales)
  .client((): LocaleSet | undefined => readClientLocaleSet());

/**
 * Набір мов, дочитаний ЛІНИВО з кешу мов (ті самі покоління, що в нормалізації),
 * для сторінки, яку нормалізація не готувала: 404 під `/api` чи `/assets`,
 * адмінка. Лише сервер: клієнт завжди має глобал із `<head>`.
 */
export const loadLocaleSetLazily = createIsomorphicFn()
  .server((): Promise<LocaleSet> => loadLocaleSet())
  .client((): Promise<LocaleSet> => Promise.resolve(readClientLocaleSet()));
