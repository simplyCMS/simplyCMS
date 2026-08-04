import { createFileRoute } from '@tanstack/react-router';
import AuthSetPassword from '@simplycms/storefront-routes/pages/AuthSetPassword';

/**
 * Встановлення пароля після invite-редіректу (спека 2026-08-03 §4.4).
 *
 * `beforeLoad`-редіректу залогіненого тут навмисно НЕМАЄ (на відміну від
 * `/auth/`): користувач приходить сюди саме із сесією, яку щойно поставив
 * `/auth/confirm`, — гард зробив би сторінку недосяжною.
 */
export const Route = createFileRoute('/auth/set-password')({
  head: () => ({
    meta: [{ title: 'Встановлення пароля' }],
  }),
  component: AuthSetPassword,
});
