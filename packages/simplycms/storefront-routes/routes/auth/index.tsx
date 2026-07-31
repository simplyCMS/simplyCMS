import { createFileRoute, redirect } from '@tanstack/react-router';
import Auth from '@simplycms/core/pages/Auth';
import { getUser } from '@simplycms/storefront-routes/server/auth';

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
  head: () => ({
    meta: [
      { title: 'Авторизація | SolarStore' },
      {
        name: 'description',
        content: 'Вхід або реєстрація в інтернет-магазині SolarStore',
      },
    ],
  }),
  component: Auth,
});
