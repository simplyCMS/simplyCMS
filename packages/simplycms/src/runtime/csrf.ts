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

/** HTTP API операцій (М1): тут Bearer-запит — не браузерний, CSRF до нього не застосовний. */
const API_PREFIX = '/api/v1/';

/**
 * Чи треба перевіряти запит. Чиста функція (юніт без підйому Start): метод
 * поза безпечними І шлях не під винятком. Тип обробника (server function чи
 * server route) не розрізняється — захист однаковий для обох.
 *
 * 🔴 Виняток для `/api/v1/` вузький: лише запит із `Authorization: Bearer …`.
 * CSRF — атака на ambient-автентифікацію (cookie), яку браузер додає сам;
 * заголовок `Authorization` чужий сайт виставити не може. Cookie-запит на
 * `/api/v1/` і `Authorization: Basic` перевіряються як і досі, а адаптер за
 * наявності `Authorization` НІКОЛИ не падає назад на cookie.
 */
export function shouldValidateCsrf(
  method: string,
  pathname: string,
  headers: Headers,
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;
  if (
    pathname.startsWith(API_PREFIX) &&
    /^Bearer\s/i.test(headers.get('authorization') ?? '')
  )
    return false;
  return !CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Request-міддлвара CSRF для `createStart({ requestMiddleware })`.
 *
 * Start вмикає свій дефолтний захист лише коли `startInstance` відсутній; у
 * магазині він є, тож без цього модуля server functions і POST-роути лишались
 * б відкритими. Решта опцій — дефолти Start: `Sec-Fetch-Site: same-origin`,
 * далі `Origin` проти origin запиту, далі `Referer`; жодного заголовка — 403.
 * Origin запиту задає не проксі: раннер магазину (`server-origin.mjs`) будує
 * URL запиту з `VITE_SITE_URL`, а `x-forwarded-*` не читає.
 *
 * Client-safe: серверних імпортів немає, а `createCsrfMiddleware` — це
 * `createIsomorphicFn().server(...)`, тож у клієнтському бандлі виклик
 * прибирається компілятором Start (як і сам `requestMiddleware`).
 */
export const csrfMiddleware = createCsrfMiddleware({
  filter: ({ request }) =>
    shouldValidateCsrf(
      request.method,
      new URL(request.url).pathname,
      request.headers,
    ),
});
