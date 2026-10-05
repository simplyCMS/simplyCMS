import { createCsrfMiddleware } from '@tanstack/react-start';

/**
 * Префікси шляхів, які CSRF-міддлвара НЕ перевіряє.
 *
 * 🔴 Список навмисно короткий. `/api/auth/` — Better Auth сам перевіряє origin
 * (trustedOrigins), подвійна перевірка тут лише ламала б його. Новий виняток
 * (напр. вебхук платіжної системи, що шле POST без `Origin`/`Sec-Fetch-Site`)
 * додається СВІДОМО, окремим рішенням із обґрунтуванням у коментарі поруч:
 * кожен виняток — це дірка в CSRF-захисті для всього піддерева шляхів.
 */
export const CSRF_EXEMPT_PREFIXES = ['/api/auth/'] as const;

/** Методи, що за семантикою HTTP не змінюють стан — CSRF-перевірці не підлягають. */
const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Чи треба перевіряти запит. Чиста функція (юніт без підйому Start): метод
 * поза безпечними І шлях не під винятком. Тип обробника (server function чи
 * server route) не розрізняється — захист однаковий для обох.
 */
export function shouldValidateCsrf(method: string, pathname: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;
  return !CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Request-міддлвара CSRF для `createStart({ requestMiddleware })`.
 *
 * Start вмикає свій дефолтний захист лише коли `startInstance` відсутній; у
 * магазині він є, тож без цього модуля server functions і POST-роути лишались
 * б відкритими. Решта опцій — дефолти Start: `Sec-Fetch-Site: same-origin`,
 * далі `Origin` проти origin запиту (за проксі — з `x-forwarded-*`), далі
 * `Referer`; жодного заголовка — 403.
 *
 * Client-safe: серверних імпортів немає, а `createCsrfMiddleware` — це
 * `createIsomorphicFn().server(...)`, тож у клієнтському бандлі виклик
 * прибирається компілятором Start (як і сам `requestMiddleware`).
 */
export const csrfMiddleware = createCsrfMiddleware({
  filter: ({ request }) =>
    shouldValidateCsrf(request.method, new URL(request.url).pathname),
});
