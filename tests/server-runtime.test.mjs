/**
 * Регресія production-runner-а (`server-runtime.mjs`). Два інциденти, які тест
 * не дає повторити: (1) помилка тіла ПІСЛЯ заголовків через `.pipe()` = смерть
 * Node-процесу від unhandled `'error'`; (2) `Request` без `signal` = розрив
 * зʼєднання клієнтом не скасовує SSR-рендер.
 */
import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';

import {
  parseSiteOrigin,
  requestPath,
  sendWebResponse,
  toRequestUrl,
  toWebRequest,
} from '../server-runtime.mjs';

const OPTIONS = { origin: 'https://shop.test', serverFnBase: '/_serverFn/' };

const encoder = new TextEncoder();

/** Піднімає HTTP-сервер на вільному порту й віддає його URL + closer. */
async function startServer(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}

const tick = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

describe('sendWebResponse', () => {
  it('переживає помилку тіла після заголовків і рве зʼєднання', async () => {
    const uncaught = [];
    const onUncaught = (error) => uncaught.push(error);
    process.on('uncaughtException', onUncaught);

    const { url, close } = await startServer((req, res) => {
      const body = new ReadableStream({
        start: (controller) => controller.enqueue(encoder.encode('чанк')),
        // Саме так падає router-core: `error` уже після заголовків.
        pull: (controller) =>
          controller.error(new Error('Stream lifetime exceeded')),
      });
      sendWebResponse(res, new Response(body, { status: 200 }));
    });

    try {
      const response = await fetch(`${url}/`);
      expect(response.status).toBe(200);
      // Зʼєднання має обірватися, а не віддати «успішне» обрізане тіло.
      await expect(response.text()).rejects.toThrow();

      await tick(); // даємо unhandled `'error'` (якби він був) вистрілити
      expect(uncaught).toEqual([]);

      // Процес живий: наступний запит обслуговується як звичайно.
      const second = await fetch(`${url}/`).catch(() => null);
      expect(second?.status).toBe(200);
      await second?.body?.cancel();
    } finally {
      process.off('uncaughtException', onUncaught);
      await close();
    }
  });

  it('віддає відповідь без тіла', async () => {
    const { url, close } = await startServer((req, res) =>
      sendWebResponse(res, new Response(null, { status: 204 })),
    );
    try {
      expect((await fetch(`${url}/`)).status).toBe(204);
    } finally {
      await close();
    }
  });

  it('мовчки виходить, якщо клієнт відпав до відповіді', async () => {
    let thrown = null;
    const { url, close } = await startServer((req, res) => {
      res.destroy();
      try {
        sendWebResponse(res, new Response('пізно', { status: 200 }));
      } catch (error) {
        thrown = error;
      }
    });
    try {
      await fetch(`${url}/`).catch(() => null);
      await tick();
      expect(thrown).toBeNull();
    } finally {
      await close();
    }
  });
});

describe('toWebRequest', () => {
  it('аборт-ить signal, коли клієнт рве зʼєднання', async () => {
    let markAborted;
    const aborted = new Promise((resolve) => {
      markAborted = resolve;
    });

    const { url, close } = await startServer((req, res) => {
      const request = toWebRequest(req, res, OPTIONS);
      request.signal.addEventListener('abort', () => markAborted(true));
      const body = new ReadableStream({
        start: (controller) => controller.enqueue(encoder.encode('чанк')),
        pull: () => new Promise(() => {}), // імітація довгого SSR-рендеру
      });
      sendWebResponse(res, new Response(body, { status: 200 }));
    });

    try {
      const clientAbort = new AbortController();
      const response = await fetch(`${url}/`, { signal: clientAbort.signal });
      await response.body.getReader().read();
      clientAbort.abort();
      await expect(aborted).resolves.toBe(true);
    } finally {
      await close();
    }
  });

  it('не аборт-ить signal на нормально завершеній відповіді', async () => {
    let wasAborted = false;
    const { url, close } = await startServer((req, res) => {
      const request = toWebRequest(req, res, OPTIONS);
      request.signal.addEventListener('abort', () => {
        wasAborted = true;
      });
      sendWebResponse(res, new Response('ок', { status: 200 }));
    });
    try {
      expect(await (await fetch(`${url}/`)).text()).toBe('ок');
      await tick();
      expect(wasAborted).toBe(false);
    } finally {
      await close();
    }
  });
});

describe('toRequestUrl — origin лише з конфігу (Р18б)', () => {
  const ORIGIN = 'https://shop.test';

  it('підроблені Host / X-Forwarded-Host / X-Forwarded-Proto ігноруються', () => {
    const url = toRequestUrl(
      {
        url: '/cart?x=1',
        headers: {
          host: 'evil.example',
          'x-forwarded-host': 'evil.example',
          'x-forwarded-proto': 'http',
        },
      },
      ORIGIN,
    );
    expect(url).toBe('https://shop.test/cart?x=1');
  });

  it('absolute-form: береться лише шлях і query', () => {
    expect(
      toRequestUrl({ url: 'http://evil.example/p?q=1', headers: {} }, ORIGIN),
    ).toBe('https://shop.test/p?q=1');
  });

  it.each(['//evil.example/x', '/\\evil.example', 'http://h//x', '*', ''])(
    'request-target %j неприйнятний: requestPath → null, toRequestUrl кидає',
    (target) => {
      expect(requestPath(target)).toBeNull();
      expect(() =>
        toRequestUrl({ url: target, headers: {} }, ORIGIN),
      ).toThrow();
    },
  );

  it('справжній Request несе origin сайту, а не заголовків клієнта', async () => {
    let seen;
    const { url, close } = await startServer((req, res) => {
      seen = toWebRequest(req, res, OPTIONS).url;
      sendWebResponse(res, new Response('ок'));
    });
    try {
      await fetch(`${url}/a/b?c=d`, {
        headers: { 'x-forwarded-host': 'evil.example' },
      });
      expect(seen).toBe('https://shop.test/a/b?c=d');
    } finally {
      await close();
    }
  });
});

describe('parseSiteOrigin', () => {
  it('http(s) → origin без шляху', () => {
    expect(parseSiteOrigin('https://shop.test/some/path')).toBe(
      'https://shop.test',
    );
    expect(parseSiteOrigin('http://127.0.0.1:3000')).toBe(
      'http://127.0.0.1:3000',
    );
  });

  it.each([undefined, '', '/relative', 'ftp://x', 'shop.test'])(
    '%j → помилка з іменем ключа, без значення',
    (raw) => {
      expect(() => parseSiteOrigin(raw)).toThrow(/VITE_SITE_URL/);
    },
  );

  it('значення з облікових даних у текст помилки не потрапляє', () => {
    try {
      parseSiteOrigin('ftp://user:s3cr3t@x');
    } catch (error) {
      expect(error.message).not.toContain('s3cr3t');
    }
  });
});
