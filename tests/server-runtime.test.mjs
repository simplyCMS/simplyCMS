/**
 * Регресія production-runner-а (`server-runtime.mjs`). Два інциденти, які тест
 * не дає повторити: (1) помилка тіла ПІСЛЯ заголовків через `.pipe()` = смерть
 * Node-процесу від unhandled `'error'`; (2) `Request` без `signal` = розрив
 * зʼєднання клієнтом не скасовує SSR-рендер.
 */
import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';

import { sendWebResponse, toWebRequest } from '../server-runtime.mjs';

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
      const request = toWebRequest(req, res);
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
      const request = toWebRequest(req, res);
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
