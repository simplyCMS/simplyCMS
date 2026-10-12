/**
 * Origin і request-target production-runner-а (Р18б).
 *
 * Самодостатній модуль (лише `node:*`/глобалі, ядро не імпортується — Е8-Р7′):
 * копії лежать у шаблоні й `packages/cli/host/` (`pnpm template:sync`).
 */

/**
 * Origin сайту з `VITE_SITE_URL` (Р18б): єдине джерело origin запиту.
 *
 * Лише `http:`/`https:` і лише абсолютний URL — порожній чи відносний origin
 * зламав би CSRF-перевірку Start і базу посилань auth. Значення в тексті
 * помилки НЕ друкуємо (воно може містити облікові дані в userinfo).
 */
export function parseSiteOrigin(raw) {
  let url;
  try {
    url = new URL(String(raw ?? ''));
  } catch {
    url = null;
  }
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    throw new Error(
      'VITE_SITE_URL не задано або це не абсолютний http(s)-URL: ' +
        'раннер будує URL запиту лише з нього',
    );
  }
  return url.origin;
}

/**
 * Шлях і query з request-target або `null`, якщо target неприйнятний.
 *
 * Origin-form мусить починатися рівно з одного `/`: `//evil/x` Start
 * сприйняв би як protocol-relative (S3-04), `/\evil` браузери читають так
 * само. 🔴 Це ДОДАТКОВИЙ рубіж: захист від чужого хоста тримається на склейці
 * origin з конфігу (`toRequestUrl`), а не на цій перевірці. Нормалізація Start
 * не відкриває чужий хост і в обхід неї (`/x/..//evil` дає 308 на СВІЙ origin).
 * Absolute-form (`http://h/p?q`) зводимо до шляху й query — хост із нього
 * ніколи не береться.
 */
export function requestPath(target) {
  if (typeof target !== 'string') return null;
  let path = target;
  if (/^https?:\/\//i.test(target)) {
    try {
      const url = new URL(target);
      path = url.pathname + url.search;
    } catch {
      return null;
    }
  }
  if (!path.startsWith('/') || path[1] === '/' || path[1] === '\\') {
    return null;
  }
  return path;
}

/**
 * Абсолютний URL запиту: origin з конфігу + шлях і query з request-target.
 *
 * 🔴 `Host`, `X-Forwarded-Host` і `X-Forwarded-Proto` для URL ігноруються
 * ЗОВСІМ: їх підробляє клієнт, а origin з `request.url` далі бере CSRF-перевірка
 * Start і Better Auth. Прапорця «довіряти проксі» немає свідомо.
 */
export function toRequestUrl(req, siteOrigin) {
  const path = requestPath(req.url ?? '/');
  if (path === null) throw new RangeError('Неприйнятний request-target');
  const url = new URL(siteOrigin + path);
  if (url.origin !== siteOrigin) throw new RangeError('Чужий origin у шляху');
  return url.toString();
}
