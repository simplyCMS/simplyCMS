/**
 * Заголовки безпеки production-runner-а (Р27) для відповідей, які віддає САМ
 * раннер: статика `sirv` і його 400/413/500. Динамічні відповіді (SSR, server
 * functions, `/media`) отримують ті самі заголовки в обгортці fetch серверного
 * входу (`simplycms/server-guard`, `src/server.ts`).
 *
 * Самодостатній модуль (ядро не імпортується — Е8-Р7′), тому перелік тут —
 * копія `SECURITY_HEADERS` ядра; розбіжність ловить
 * `tests/server-headers-parity.test.ts`. Копії лежать у шаблоні й
 * `packages/cli/host/` (`pnpm template:sync`).
 */
export const SECURITY_HEADERS = [
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-Frame-Options', 'SAMEORIGIN'],
  ['Content-Security-Policy', "frame-ancestors 'self'"],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
];

/** HSTS — лише для https-сайту: на http він нічого не дає. */
export const HSTS_HEADER = ['Strict-Transport-Security', 'max-age=31536000'];

/**
 * Заголовки безпеки як обʼєкт `{ ім'я: значення }` — придатний і для
 * `res.setHeader` у `sirv`, і для `res.writeHead(status, headers)`.
 * `siteOrigin` — уже розібраний `VITE_SITE_URL` (`parseSiteOrigin`).
 */
export function securityHeaders(siteOrigin) {
  const list = siteOrigin.startsWith('https:')
    ? [...SECURITY_HEADERS, HSTS_HEADER]
    : SECURITY_HEADERS;
  return Object.fromEntries(list);
}
