/**
 * Production-runner магазину.
 *
 * `vite build` віддає `dist/client` (статика) + `dist/server/server.js`
 * (fetch-handler, БЕЗ власного HTTP-сервера). Цей файл — той самий Node-шар:
 * статику віддає `sirv`, решту конвертує `IncomingMessage → Request`, кличе
 * fetch-handler і стрімить `Response` назад у `ServerResponse`.
 *
 * Запуск: `pnpm start` (порт із `PORT`, за замовчуванням 3000).
 */
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sirv from 'sirv';

import serverEntry from './dist/server/server.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

// Асети мають хеш у назві → кешуються назавжди; решта (favicon тощо) — коротко.
const serveStatic = sirv(join(ROOT, 'dist', 'client'), {
  dev: false,
  etag: true,
  gzip: true,
  brotli: true,
  setHeaders: (res, pathname) => {
    if (pathname.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
});

/** `IncomingMessage.headers` → web `Headers` (масиви розкладаємо в append). */
function toWebHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (value === undefined || key.startsWith(':')) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

/** Абсолютний URL запиту з урахуванням reverse-proxy заголовків. */
function toRequestUrl(req) {
  const proto = req.headers['x-forwarded-proto'] ?? 'http';
  const host =
    req.headers['x-forwarded-host'] ?? req.headers.host ?? `localhost:${PORT}`;
  return new URL(req.url ?? '/', `${proto}://${host}`).toString();
}

/** `IncomingMessage` → web `Request` (тіло — стрімом, без буферизації). */
function toWebRequest(req) {
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(toRequestUrl(req), {
    method: req.method,
    headers: toWebHeaders(req.headers),
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? 'half' : undefined,
  });
}

/** Стрімить web `Response` у `ServerResponse` (SSR у Start — потоковий). */
function sendWebResponse(res, response) {
  const headers = {};
  for (const [key, value] of response.headers) {
    if (key === 'set-cookie') continue;
    headers[key] = value;
  }
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) headers['set-cookie'] = cookies;

  res.writeHead(response.status, headers);

  if (!response.body) {
    res.end();
    return;
  }
  Readable.fromWeb(response.body).pipe(res);
}

const server = createServer((req, res) => {
  serveStatic(req, res, async () => {
    try {
      const response = await serverEntry.fetch(toWebRequest(req));
      sendWebResponse(res, response);
    } catch (error) {
      console.error('[server] Необроблена помилка запиту:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      }
      res.end('Internal Server Error');
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[server] SimplyCMS слухає http://${HOST}:${PORT}`);
});
