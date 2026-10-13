/**
 * Р27 на СПРАВЖНЬОМУ збереженому сервері: усі п'ять заголовків безпеки на SSR,
 * статиці `sirv`, 404 і sitemap; сайт на http — HSTS мусить бути відсутній.
 */
const HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'content-security-policy': "frame-ancestors 'self'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * @param {object} p
 * @param {string} p.base `http://127.0.0.1:<port>`
 * @param {(label: string, passed: boolean, fact: string) => void} p.check
 */
export async function runSecurityHeaderChecks({ base, check }) {
  // Заголовки на справжній відповіді (SSR, статика, 4xx). Сайт на http —
  // HSTS мусить бути відсутній.
  const css = /assets\/[^"']+\.css/.exec(
    await (await fetch(`${base}/`)).text(),
  );
  const channels = [
    ['SSR /', '/'],
    ['статика sirv', css ? `/${css[0]}` : '/favicon.ico'],
    ['SSR 404', '/catalog/немає-такого/ні-товару'],
    ['sitemap', '/sitemap.xml'],
  ];
  for (const [label, path] of channels) {
    const res = await fetch(`${base}${path}`);
    const missing = Object.entries(HEADERS).filter(
      ([name, value]) => res.headers.get(name) !== value,
    );
    check(
      `Р27 заголовки: ${label}`,
      missing.length === 0 && !res.headers.has('strict-transport-security'),
      missing.length === 0
        ? `${res.status}`
        : missing.map(([n]) => n).join(', '),
    );
  }
}
