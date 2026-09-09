import { createAuthClient } from 'better-auth/react';

/**
 * Клієнт Better Auth для вітрини (К1′б).
 *
 * 🔴 Конфігурації немає навмисно. `better-auth/react` за замовчуванням б'є в
 * `/api/auth` того самого походження, а роут ядра
 * (`routes/storefront/api/auth/$.tsx`) саме там і змонтований — обидві
 * сторони беруть ОДИН дефолт. Явний `baseURL` тут був би третьою копією
 * того самого шляху й першим кандидатом розійтися.
 *
 * 🔴 Один інстанс на застосунок: клієнт тримає nanostores-атом сесії, на який
 * підписані всі `useSession()`. Другий інстанс дав би друге джерело правди —
 * вхід в одній частині дерева не оновив би іншу.
 */
export const authClient = createAuthClient();

/** Користувач сесії у формі, яку віддає Better Auth. */
export type AuthUser = typeof authClient.$Infer.Session.user;

/** Сама сесія (термін дії, id, токен) — без користувача. */
export type AuthSession = typeof authClient.$Infer.Session.session;
