import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from 'simplycms/auth';

/**
 * Точка монтування Better Auth (`/api/auth/*`) — К1′б.
 *
 * BA віддає власний fetch-handler, тож роут лишається тонким: він не парсить
 * тіло, не читає cookie й не будує редіректів. Відповідь віддається як є —
 * саме в її заголовках їдуть `Set-Cookie` сесії.
 *
 * 🔴 Splat (`$`), а не окремі файли на кожну дію: набір ендпойнтів BA
 * (`sign-in/email`, `sign-up/email`, `get-session`, `sign-out`,
 * `request-password-reset`, `reset-password`, …) задає сам BA і змінює
 * версією. Перелічувати їх у роутері означало б тримати другу копію чужого
 * контракту й ловити розсинхрон 404-ю на проді.
 *
 * 🔴 `/api/auth` — базовий шлях BA за замовчуванням, тому клієнту
 * (`better-auth/react`) окремої конфігурації не потрібно: обидві сторони
 * беруть один і той самий дефолт.
 */
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => getAuth().handler(request),
      POST: ({ request }: { request: Request }) => getAuth().handler(request),
    },
  },
});
