/**
 * Базові заголовки безпеки (Р27) — ОДИН перелік для динамічних відповідей
 * (SSR, server functions, `/media`, sitemap/robots: обгортка fetch-хендлера у
 * `src/server.ts`). Статику `sirv` і власні відповіді раннера (400/413/500)
 * віддає `server.mjs`; ядро він не імпортує (Е8-Р7′), тож тримає копію цього
 * переліку у `server-headers.mjs` під тестом парності
 * (`tests/server-headers-parity.test.ts`).
 *
 * `frame-ancestors 'self'` — єдина директива CSP навмисно: повна політика
 * (script-src тощо) зламала б інлайн-скрипти Start і теми. `X-Frame-Options`
 * дублює її для старих браузерів.
 */
export const SECURITY_HEADERS = [
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-Frame-Options', 'SAMEORIGIN'],
  ['Content-Security-Policy', "frame-ancestors 'self'"],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
] as const satisfies ReadonlyArray<readonly [string, string]>;

/** HSTS — лише коли сайт справді на https: на http він нічого не дає. */
export const HSTS_HEADER = [
  'Strict-Transport-Security',
  'max-age=31536000',
] as const;

/** Чи origin сайту (`VITE_SITE_URL`) — https. Некоректне значення = ні. */
function isHttpsSite(siteUrl: string | undefined): boolean {
  try {
    return new URL(siteUrl ?? '').protocol === 'https:';
  } catch {
    return false;
  }
}

/** Заголовки безпеки для сайту з даним `VITE_SITE_URL`. */
export function securityHeaders(
  siteUrl: string | undefined,
): ReadonlyArray<readonly [string, string]> {
  return isHttpsSite(siteUrl)
    ? [...SECURITY_HEADERS, HSTS_HEADER]
    : SECURITY_HEADERS;
}

type FetchHandler<A extends unknown[]> = (
  request: Request,
  ...rest: A
) => Response | Promise<Response>;

/**
 * Дописує відсутні заголовки. Відповідь із незмінними заголовками
 * (`Response.redirect()`, результат `fetch()`) перепаковуємо, а не губимо.
 */
function stamp(
  response: Response,
  headers: ReadonlyArray<readonly [string, string]>,
): Response {
  let target = response;
  for (const [name, value] of headers) {
    // Заголовок, який хендлер виставив сам, не перебиваємо: роут може свідомо
    // дати суворішу політику.
    if (target.headers.has(name)) continue;
    try {
      target.headers.set(name, value);
    } catch {
      target = new Response(target.body, target);
      target.headers.set(name, value);
    }
  }
  return target;
}

/**
 * Обгортає fetch-хендлер серверного входу: усі відповіді, у т.ч. від SEO-
 * перехоплювача й Start, отримують заголовки безпеки. `siteUrl` читає
 * викликач (`process.env.VITE_SITE_URL` у рантаймі), модуль env не торкається.
 */
export function withSecurityHeaders<A extends unknown[]>(
  handler: FetchHandler<A>,
  siteUrl: string | undefined,
): FetchHandler<A> {
  const headers = securityHeaders(siteUrl);
  return async (request, ...rest) =>
    stamp(await handler(request, ...rest), headers);
}
