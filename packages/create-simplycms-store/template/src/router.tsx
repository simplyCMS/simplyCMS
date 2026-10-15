import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { routeTree } from './routeTree.gen';
import { createRouterLocale } from 'simplycms/storefront-routes/locale/router';
import { RouteError } from './route-error';

/**
 * 🔴 `QueryClient` народжується ТУТ, а не в `CMSProvider`.
 *
 * Причина архітектурна: колекції TanStack DB (Е1б) memoізуються по
 * інстансу `QueryClient` і потрібні в `loader` роуту — тобто ПОЗА
 * React-деревом. Клієнт, створений усередині провайдера, там недосяжний.
 *
 * Дефолти ті самі, що були в `CMSProvider`, — переїзд не міняє поведінки
 * кешу, лише місце створення.
 *
 * Мовний контекст запиту (набір мов у `context.locales` і `rewrite` префіксів
 * мов) будує ядро: сервер бере набір із контексту запиту, клієнт — з
 * глобала мов у `window` (його пише скрипт у `<head>` кореня). Роутер створюється на запит, тож стан `rewrite`
 * не ділиться між запитами.
 */
export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5 * 60 * 1000, retry: 1 },
    },
  });

  const { locales, rewrite } = createRouterLocale();

  return createTanStackRouter({
    routeTree,
    context: { queryClient, locales },
    rewrite,
    scrollRestoration: true,
    // Р23: без цього дочірні роути показують дефолт TanStack з повним `error.message`.
    defaultErrorComponent: RouteError,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
