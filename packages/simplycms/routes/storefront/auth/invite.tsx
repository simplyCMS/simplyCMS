import { createFileRoute } from '@tanstack/react-router';
import AuthInvite from 'simplycms/storefront-routes/pages/AuthInvite';

/**
 * Прийняття запрошення власника (`/auth/invite?email=&token=`).
 *
 * Гарда «залогінений → геть» тут немає навмисно, як і на `/auth/set-password`:
 * посилання приходить листом, і чинна сесія покупця не має заважати власнику
 * прийняти запрошення.
 *
 * 🔴 `head()` не оголошується: заголовок сторінки був би кириличним рядком
 * поза React-контекстом, а це саме той борг, який реєструє
 * `tests/i18n-coverage/pending.ts`. Дефолт `__root.tsx` («SimplyCMS Store»)
 * тут доречніший за новий запис у реєстрі.
 */
export const Route = createFileRoute('/auth/invite')({
  component: AuthInvite,
});
