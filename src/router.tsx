import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { routeTree } from './routeTree.gen';

/**
 * 🔴 `QueryClient` народжується ТУТ, а не в `CMSProvider`.
 *
 * Причина архітектурна: колекції TanStack DB (Е1б) memoізуються по
 * інстансу `QueryClient` і потрібні в `loader` роуту — тобто ПОЗА
 * React-деревом. Клієнт, створений усередині провайдера, там недосяжний.
 *
 * Дефолти ті самі, що були в `CMSProvider`, — переїзд не міняє поведінки
 * кешу, лише місце створення.
 */
export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5 * 60 * 1000, retry: 1 },
    },
  });

  return createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
