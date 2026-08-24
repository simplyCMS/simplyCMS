import { createFileRoute } from '@tanstack/react-router';
import AuthSetPassword from 'simplycms/storefront-routes/pages/AuthSetPassword';

/**
 * Встановлення нового пароля за одноразовим токеном (К1′б).
 *
 * `beforeLoad`-редіректу залогіненого тут навмисно НЕМАЄ (на відміну від
 * `/auth/`): сюди веде посилання з листа, і власник ЧИННОЇ сесії теж має
 * право змінити пароль — гард зробив би цей випадок недосяжним.
 */
export const Route = createFileRoute('/auth/set-password')({
  head: () => ({
    meta: [{ title: 'Встановлення пароля' }],
  }),
  component: AuthSetPassword,
});
