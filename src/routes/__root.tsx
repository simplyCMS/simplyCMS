import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import { useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@simplycms/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { CMSProvider } from '@simplycms/core/providers/CMSProvider';
import { bootstrapPlugins } from '@simplycms/plugins';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { I18nProvider, normalizeLocale } from '@simplycms/i18n';
import { ClientEngineProvider } from '../engine-provider';
import config from '../../simplycms.config';
import { getActiveTheme } from '@simplycms/storefront-routes/server/themes';
import { serializeActiveThemeScript } from '@simplycms/storefront-routes/active-theme';
import appCss from '../styles/globals.css?url';

// Side-effect: реєстрація тем в ThemeRegistry (ізоморфно)
import '../theme-registry';

export const Route = createRootRoute({
  // Резолвимо активну тему один раз на рівні root — її назву інлайн-скриптом
  // прокидаємо клієнту, щоб той прогрів саме цю тему ДО гідрації (без suspend).
  loader: async () => {
    const record = await getActiveTheme();
    return { activeThemeName: record?.name ?? 'default' };
  },
  notFoundComponent: NotFound,
  errorComponent: ErrorBoundary,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'SimplyCMS Store' },
      {
        name: 'description',
        content: 'SimplyCMS — open-source e-commerce CMS platform',
      },
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
  const { activeThemeName } = Route.useLoaderData();
  // Локаль магазину — з конфіга, один раз на рендер (без глобального стану).
  const locale = normalizeLocale(config.locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Назва активної теми для клієнта (прогрів кешу до гідрації) */}
        <script
          dangerouslySetInnerHTML={{
            __html: serializeActiveThemeScript(activeThemeName),
          }}
        />
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        {/* I18nProvider — над усіма групами роутів (storefront, auth, protected) */}
        <I18nProvider locale={locale}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <CMSProvider>
              <PluginBootstrap />
              <ClientEngineProvider>
                <Outlet />
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
  const supabase = useSupabaseClient();

  useEffect(() => {
    void bootstrapPlugins(config.plugins ?? [], supabase);
  }, [supabase]);

  return null;
}

/** 404 — сторінку не знайдено */
function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="mt-4 text-xl text-muted-foreground">Сторінку не знайдено</p>
      <Link to="/" className="mt-8 underline hover:text-foreground">
        На головну
      </Link>
    </div>
  );
}

/** Глобальний error boundary */
function ErrorBoundary({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">Щось пішло не так</h1>
      <p className="mt-4 text-muted-foreground">
        {error?.message ?? 'Сталася непередбачувана помилка.'}
      </p>
      <Link to="/" className="mt-8 underline hover:text-foreground">
        На головну
      </Link>
    </div>
  );
}
