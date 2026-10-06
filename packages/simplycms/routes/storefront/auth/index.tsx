import { createFileRoute, redirect } from '@tanstack/react-router';
import Auth from 'simplycms/storefront-routes/pages/Auth';
import { getUser } from 'simplycms/storefront-routes/server/auth';
import { storefrontHead } from 'simplycms/storefront-routes/head/head';

/**
 * Сторінка авторизації (логін / реєстрація).
 *
 * `ssr: 'data-only'` — `beforeLoad` виконується на сервері (редиректить уже
 * залогіненого користувача на `/` ще до віддачі HTML, паритет зі старим proxy.ts),
 * а сама форма рендериться на клієнті.
 */
export const Route = createFileRoute('/auth/')({
  ssr: 'data-only',
  beforeLoad: async () => {
    const user = await getUser();
    if (user) {
      throw redirect({ to: '/' });
    }
  },
  head: ({ matches }) =>
    storefrontHead(matches, (t) => ({ title: t('auth.login.title') })),
  component: Auth,
});
