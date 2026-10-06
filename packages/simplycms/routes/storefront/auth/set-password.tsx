import { createFileRoute } from '@tanstack/react-router';
import AuthSetPassword from 'simplycms/storefront-routes/pages/AuthSetPassword';
import { storefrontHead } from 'simplycms/storefront-routes/head/head';

/**
 * Встановлення нового пароля за одноразовим токеном (К1′б).
 *
 * `beforeLoad`-редіректу залогіненого тут навмисно НЕМАЄ (на відміну від
 * `/auth/`): сюди веде посилання з листа, і власник ЧИННОЇ сесії теж має
 * право змінити пароль — гард зробив би цей випадок недосяжним.
 */
export const Route = createFileRoute('/auth/set-password')({
  head: ({ matches }) =>
    storefrontHead(matches, (t) => ({ title: t('auth.setPassword.title') })),
  component: AuthSetPassword,
});
