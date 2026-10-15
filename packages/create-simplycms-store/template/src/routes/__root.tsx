import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import type { RouterContext } from 'simplycms/runtime';
import { useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'simplycms/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { CMSProvider } from 'simplycms/core/providers/CMSProvider';
// 🔴 Субшлях, а не барель `simplycms/plugins`: барель тягне ще й
// `PluginLoader` із серверним модулем `simplycms/plugins/server`. Тут корінь
// застосунку — у нього цей вантаж потрапляти не має.
import { bootstrapPlugins } from 'simplycms/plugins/bootstrap';
import { bootstrapThemes } from 'simplycms/themes/bootstrapThemes';
import { useAuth } from 'simplycms/core/hooks/useAuth';
import { I18nProvider } from 'simplycms/i18n';
import { ClientEngineProvider } from '../engine-provider';
import { RouteError } from '../route-error';
import config from '../../simplycms.config';
import { homeHead } from 'simplycms/storefront-routes/head/head';
import {
  loadStorefrontRoot,
  resolveRouterLocales,
} from 'simplycms/storefront-routes/locale/root-data';
import { RootNotFound } from 'simplycms/storefront-routes/locale/RootNotFound';
import { htmlLangAttrs } from 'simplycms/storefront-routes/locale/lang-attrs';
import { serializeLocalesScript } from 'simplycms/storefront-routes/locale/script';
import { StoreProfileProvider } from 'simplycms/themes/store-profile';
import { serializeActiveThemeScript } from 'simplycms/storefront-routes/active-theme';
import appCss from '../styles/globals.css?url';

// Side-effect: реєстрація тем в ThemeRegistry (ізоморфно)
import '../theme-registry';

/**
 * Контекст кореневого роуту: `QueryClient`, народжений у `getRouter()`
 * (`src/router.tsx`). Тип живе в пакеті (`simplycms/runtime`) — роут-файли
 * ядра (routes/admin/**) типізують ним `context.queryClient` у своїх
 * loader-ах і не можуть імпортувати з host у зворотному напрямку. Тут —
 * лише реекспорт, щоб `RootComponent` і локальний код host-а могли
 * дістати той самий інстанс через `Route.useRouteContext()`.
 */
export type { RouterContext };

export const Route = createRootRouteWithContext<RouterContext>()({
  // Корінь вітрини одним викликом (Е6б-10): назву активної теми інлайн-скриптом
  // прокидаємо клієнту, щоб той прогрів саме цю тему ДО гідрації (без suspend);
  // профіль магазину, URL сайту, мову сторінки й набір мов читає `head()` кожного
  // роуту ядра через `matches` — іншого каналу від host-а до ядра немає. Мова —
  // з префікса URL (`location.publicHref`), набір мов — з контексту роутера.
  // Набір мов для запиту без нормалізації (404 під /api, адмінка) дочитується тут.
  beforeLoad: async ({ context }) => ({
    locales: await resolveRouterLocales(context.locales),
  }),
  loader: ({ location, context }) =>
    loadStorefrontRoot(location.publicHref, context.locales),
  notFoundComponent: RootNotFound,
  errorComponent: RouteError,
  head: ({ loaderData }) => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      // Дефолт для роутів без власного head(): заголовок головної або назва.
      ...(loaderData ? homeHead(loaderData.storeProfile).meta : []),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const { activeThemeName, storeProfile, locale, languages } =
    Route.useLoaderData();
  const { queryClient } = Route.useRouteContext();

  return (
    <html {...htmlLangAttrs(locale)} suppressHydrationWarning>
      <head>
        {/* Назва активної теми для клієнта (прогрів кешу до гідрації) */}
        <script
          dangerouslySetInnerHTML={{
            __html: serializeActiveThemeScript(activeThemeName),
          }}
        />
        {/* Набір мов для клієнтського rewrite: роутер створюється ДО гідрації */}
        <script
          dangerouslySetInnerHTML={{
            __html: serializeLocalesScript(languages),
          }}
        />
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        {/* I18nProvider — над усіма групами роутів (storefront, auth, protected) */}
        <I18nProvider locale={locale} fallback={languages.primary}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <CMSProvider queryClient={queryClient}>
              <PluginBootstrap />
              <ThemeBootstrap />
              <ClientEngineProvider>
                <StoreProfileProvider profile={storeProfile}>
                  <Outlet />
                </StoreProfileProvider>
                <Toaster />
                <SonnerToaster richColors position="top-right" />
              </ClientEngineProvider>
            </CMSProvider>
          </ThemeProvider>
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Клієнтський bootstrap плагінів із `simplycms.config.ts`.
 *
 * Виклик в ефекті (тільки браузер) — НЕ блокує гідрацію: слоти `PluginSlot`
 * підписані на HookRegistry через useSyncExternalStore, тож віджети зʼявляться
 * самі, щойно активні плагіни зареєструються. SSR-слоти вітрини в цій фазі
 * не вмикаємо — PluginSlot і так виконує хуки в ефекті.
 */
function PluginBootstrap() {
  // Прапорець — лише економія виклику: право на запис перевіряє сервер
  // (`registerPlugins` → сесія Better Auth). Клієнт тут нічого не вирішує.
  const { isAdmin } = useAuth();

  useEffect(() => {
    void bootstrapPlugins(config.plugins ?? [], isAdmin);
  }, [isAdmin]);

  return null;
}

/**
 * Клієнтський bootstrap тем: дописує в таблицю `themes` рядки для тем, які
 * зареєстровані в `simplycms.config.ts`, але БД про них ще не знає.
 *
 * Без цього адмінка не побачила б встановлену пакетом тему — вона читає ЛИШЕ
 * БД. Набір тем береться з `ThemeRegistry` (його наповнює side-effect-імпорт
 * `../theme-registry` вище), тож окремого пропа з конфігу тут не потрібно.
 * В ефекті — з тієї ж причини, що й плагіни: не блокувати гідрацію.
 */
function ThemeBootstrap() {
  const { isAdmin } = useAuth();

  useEffect(() => {
    void bootstrapThemes(isAdmin);
  }, [isAdmin]);

  return null;
}
