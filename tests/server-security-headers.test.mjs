/**
 * Р27 через СПРАВЖНІЙ `server.mjs` (смок-пісочниця): див. коментар нижче.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rawExchange } from './server-smoke/raw-exchange.mjs';
import { startSmokeServer } from './server-smoke/sandbox.mjs';

/**
 * Р27: базові заголовки безпеки на КОЖНОМУ каналі відповіді. Динаміку (SSR,
 * server functions, `/media`) стампує справжня обгортка ядра навколо стаба, а
 * статику `sirv` і власні відповіді раннера (400/413/500) — сам `server.mjs`;
 * тож канали рознесено навмисно: прибрана копія в `server-headers.mjs` червонить
 * статику й 4xx/5xx, прибрана обгортка ядра — динаміку.
 */
const SECURITY_HEADERS_SRC = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'packages/simplycms/src/server-guard/security-headers.ts',
);

const WRAPPED_HANDLER = `export const SERVER_FN_BASE = '/_serverFn/';
import { withSecurityHeaders } from ${JSON.stringify(SECURITY_HEADERS_SRC)};
const inner = async (request) => {
  if (new URL(request.url).pathname === '/__boom') throw new Error('boom');
  return new Response('<!doctype html>', {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
};
export default { fetch: withSecurityHeaders(inner, process.env.VITE_SITE_URL) };
`;

const EXPECTED_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'content-security-policy': "frame-ancestors 'self'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};
const HSTS = 'strict-transport-security';

/** Усі п’ять заголовків є дослівно; HSTS — за очікуванням. */
function expectSecurityHeaders(get, hsts) {
  for (const [name, value] of Object.entries(EXPECTED_HEADERS)) {
    expect(get(name), name).toBe(value);
  }
  expect(get(HSTS) ?? null).toBe(hsts ? 'max-age=31536000' : null);
}

describe.each([
  ['https', 'https://shop.test', true],
  ['http', 'http://shop.test', false],
])(
  'server.mjs: заголовки безпеки (Р27), сайт на %s',
  (_name, siteUrl, hsts) => {
    let server;
    let port;

    beforeAll(async () => {
      server = await startSmokeServer(
        { VITE_SITE_URL: siteUrl },
        WRAPPED_HANDLER,
      );
      port = Number(new URL(server.baseUrl).port);
    }, 30_000);

    afterAll(() => server?.stop());

    it.each([
      ['SSR /', '/'],
      ['server function /_serverFn/x', '/_serverFn/x'],
      ['/media/<ключ>', '/media/ab/0123.webp'],
      ['статика sirv /assets/*', '/assets/app-smoke123.js'],
      ['статика sirv поза /assets', '/favicon.ico'],
      ['500 раннера', '/__boom'],
    ])('%s', async (_label, path) => {
      const response = await fetch(`${server.baseUrl}${path}`);
      expectSecurityHeaders((n) => response.headers.get(n), hsts);
    });

    it('400 раннера (поганий request-target)', async () => {
      const { status, headers } = await rawExchange(
        port,
        'GET //evil//x HTTP/1.1\r\nHost: shop.test\r\n\r\n',
      );
      expect(status).toBe(400);
      expectSecurityHeaders((n) => headers[n], hsts);
    });

    it('413 раннера (Content-Length понад стелю)', async () => {
      const { status, headers } = await rawExchange(
        port,
        'POST /x HTTP/1.1\r\nHost: shop.test\r\nContent-Type: application/json\r\n' +
          'Content-Length: 99999999\r\n\r\n',
      );
      expect(status).toBe(413);
      expectSecurityHeaders((n) => headers[n], hsts);
    });
  },
);
