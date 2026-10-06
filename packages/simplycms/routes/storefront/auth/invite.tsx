import { createFileRoute } from '@tanstack/react-router';
import AuthInvite from 'simplycms/storefront-routes/pages/AuthInvite';
import { storefrontHead } from 'simplycms/storefront-routes/head/head';

/**
 * Прийняття запрошення власника (`/auth/invite?email=&token=`).
 *
 * Гарда «залогінений → геть» тут немає навмисно, як і на `/auth/set-password`:
 * посилання приходить листом, і чинна сесія покупця не має заважати власнику
 * прийняти запрошення.
 *
 * Заголовок — через i18n локалі магазину з кореневих даних (Е6б-10): раніше
 * `head()` тут не оголошувався, бо ядро не мало доступу до локалі.
 */
export const Route = createFileRoute('/auth/invite')({
  head: ({ matches }) =>
    storefrontHead(matches, (t) => ({ title: t('auth.invite.title') })),
  component: AuthInvite,
});
