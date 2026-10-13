/**
 * Смок production-runner-а `server.mjs` — файла, яким магазин реально
 * стартує (`pnpm start`) і якого до 2026-08-21 не ВИКОНУВАВ жоден гейт.
 *
 * Посилалися на нього лише ті контури, що в CI не ганяються: пілот
 * (`scripts/pilot-pack/{build,gate-b}.mjs` — потребує живої БД) і два тести,
 * які читають його як ТЕКСТ (`create-store-invite-setup`, `cli-update`).
 * `playwright.config.ts` піднімає `vite dev`, а `server-runtime.test.mjs`
 * покриває лише сусідній модуль конвертації. Тобто ані цикл наповнення env,
 * ані гілка `sirv`, ані 500-хендлер не виконувалися ніде.
 *
 * Тут вони виконуються — на справжньому `server.mjs`, але поверх заглушки
 * fetch-handler-а (`tests/server-smoke/sandbox.mjs`), тож тесту не потрібні
 * ані `pnpm build`, ані БД, ані мережа. Що лишається за цим гейтом:
 * рендер реального `dist/server/server.js` — це Gate B пілота.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rawExchange } from './server-smoke/raw-exchange.mjs';
import {
  runSmokeExpectingExit,
  SMOKE_SITE_URL,
  startSmokeServer,
} from './server-smoke/sandbox.mjs';

describe('server.mjs: production-runner піднімається й обслуговує запити', () => {
  let server;

  beforeAll(async () => {
    server = await startSmokeServer();
  }, 30_000);

  afterAll(() => server?.stop());

  it('віддає 200 і HTML на /', async () => {
    const response = await fetch(`${server.baseUrl}/`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    await expect(response.text()).resolves.toContain('<!doctype html>');
  });

  it('статика з /assets/* — immutable на рік', async () => {
    const asset = await fetch(`${server.baseUrl}/assets/app-smoke123.js`);

    expect(asset.status).toBe(200);
    expect(asset.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );

    // Контроль умовності гілки: файл поза `/assets/` хеша в імені не має,
    // тож вічний кеш йому не ставиться.
    const favicon = await fetch(`${server.baseUrl}/favicon.ico`);
    expect(favicon.status).toBe(200);
    expect(favicon.headers.get('cache-control') ?? '').not.toContain(
      'immutable',
    );
  });

  it('помилка запиту → 500, процес живий', async () => {
    const boom = await fetch(`${server.baseUrl}/__boom`);

    expect(boom.status).toBe(500);
    await expect(boom.text()).resolves.toBe('Internal Server Error');

    // Наступний запит мусить обслужитися — 500 не валить сервер.
    const after = await fetch(`${server.baseUrl}/`);
    expect(after.status).toBe(200);
  });

  it('env наповнюється лише для ВІДСУТНІХ ключів', async () => {
    const env = await (await fetch(`${server.baseUrl}/__env`)).json();

    expect(env).toEqual({
      // Реальний env процесу б'є обидва файли.
      SMOKE_FROM_PROCESS: 'from-process',
      // `.env.local` читається першим, тож `.env` його не перетирає.
      SMOKE_SHARED: 'from-env-local',
      SMOKE_ONLY_LOCAL: 'from-env-local',
      // Ключ, якого немає ні в процесі, ні в `.env.local`, бере `.env`.
      SMOKE_ONLY_ENV: 'from-env',
    });
  });

  it('MIGRATION_DATABASE_URL з .env.local у процес сервера не потрапляє', async () => {
    const keys = await (await fetch(`${server.baseUrl}/__keys`)).json();

    expect(keys).toContain('SMOKE_ONLY_LOCAL');
    expect(keys).not.toContain('MIGRATION_DATABASE_URL');
  });
});

describe('server.mjs: помилка імпорту серверного бандла валить старт до listen', () => {
  it('помилка групи env (code) → exit ≠ 0, лише message без стека, порт не слухається', async () => {
    const { code, stdout, stderr } = await runSmokeExpectingExit({
      SMOKE_DRIVER_ENV_ERROR: 'Група S3 задана не повністю: бракує S3_ENDPOINT',
    });

    expect(code).not.toBe(0);
    expect(stderr).toContain('S3_ENDPOINT');
    expect(stderr).not.toMatch(/\n\s+at /);
    expect(stdout).not.toContain('слухає');
  });

  it('будь-яка інша помилка імпорту → exit ≠ 0 і повний стек', async () => {
    const { code, stdout, stderr } = await runSmokeExpectingExit({
      SMOKE_OTHER_ERROR: 'зламаний бандл',
    });

    expect(code).not.toBe(0);
    expect(stderr).toContain('зламаний бандл');
    expect(stderr).toMatch(/\n\s+at /);
    expect(stdout).not.toContain('слухає');
  });
});

describe('server.mjs: база serverFn з експорту бандла (Р20′)', () => {
  it('бандл без SERVER_FN_BASE → exit ≠ 0 до listen, підказка про update --write', async () => {
    const { code, stdout, stderr } = await runSmokeExpectingExit(
      {},
      'export default { fetch: async () => new Response("ok") };\n',
    );
    expect(code).not.toBe(0);
    expect(stderr).toContain('SERVER_FN_BASE');
    expect(stderr).toContain('simplycms update --write');
    expect(stdout).not.toContain('слухає');
  });
});

describe('server.mjs: прод-режим не залежить від NODE_ENV власника (Р16)', () => {
  const IGNORED = 'проігноровано: server.mjs завжди production';

  it('NODE_ENV не задано → бандл бачить production, рядка про ігнорування немає', async () => {
    const server = await startSmokeServer();
    try {
      const seen = await (await fetch(`${server.baseUrl}/__node_env`)).json();
      expect(seen).toBe('production');
      expect(server.log()).not.toContain(IGNORED);
    } finally {
      server.stop();
    }
  });

  it('NODE_ENV=development → production у бандлі й рівно один рядок-попередження', async () => {
    const server = await startSmokeServer({ NODE_ENV: 'development' });
    try {
      const seen = await (await fetch(`${server.baseUrl}/__node_env`)).json();
      expect(seen).toBe('production');
      expect(server.log().split(IGNORED).length - 1).toBe(1);
      expect(server.log()).toContain('NODE_ENV=development');
    } finally {
      server.stop();
    }
  });
});

describe('server.mjs: origin запиту лише з VITE_SITE_URL (Р18б)', () => {
  it('підроблені Host / X-Forwarded-* не змінюють request.url у хендлері', async () => {
    const server = await startSmokeServer();
    try {
      const url = await (
        await fetch(`${server.baseUrl}/__url?a=1`, {
          headers: {
            host: 'evil.example',
            'x-forwarded-host': 'evil.example',
            'x-forwarded-proto': 'http',
          },
        })
      ).json();
      expect(url).toBe(`${SMOKE_SITE_URL}/__url?a=1`);
    } finally {
      server.stop();
    }
  });

  it('GET //evil//x → 400 без Location (а не 308 на чужий хост, S3-04)', async () => {
    const server = await startSmokeServer();
    try {
      const port = Number(new URL(server.baseUrl).port);
      const raw = await new Promise((resolve, reject) => {
        const socket = connect(port, '127.0.0.1');
        let data = '';
        socket.on('data', (chunk) => (data += chunk));
        socket.on('close', () => resolve(data));
        socket.on('error', reject);
        socket.write(
          'GET //evil//x HTTP/1.1\r\nHost: shop.test\r\nConnection: close\r\n\r\n',
        );
      });
      expect(raw.split(' ')[1]).toBe('400');
      expect(raw.toLowerCase()).not.toContain('location:');
    } finally {
      server.stop();
    }
  });

  it.each([
    ['не задано', undefined],
    ['порожнє', ''],
    ['відносне', '/relative'],
    ['протокол ftp', 'ftp://x'],
  ])(
    'VITE_SITE_URL %s → exit ≠ 0 до listen, у stderr імʼя ключа',
    async (_n, value) => {
      const { code, stdout, stderr } = await runSmokeExpectingExit({
        VITE_SITE_URL: value,
      });
      expect(code).not.toBe(0);
      expect(stderr).toContain('VITE_SITE_URL');
      expect(stdout).not.toContain('слухає');
    },
  );
});

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
