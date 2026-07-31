/**
 * Production-runner магазину.
 *
 * `vite build` віддає `dist/client` (статика) + `dist/server/server.js`
 * (fetch-handler, БЕЗ власного HTTP-сервера). Цей файл — той самий Node-шар:
 * статику віддає `sirv`, решту конвертує `IncomingMessage → Request`, кличе
 * fetch-handler і стрімить `Response` назад у `ServerResponse` (конвертація —
 * у `server-runtime.mjs`, він самодостатній і покритий тестами).
 *
 * Запуск: `pnpm start` (порт із `PORT`, за замовчуванням 3000).
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sirv from 'sirv';

import { sendWebResponse, toWebRequest } from './server-runtime.mjs';
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

const server = createServer((req, res) => {
  serveStatic(req, res, async () => {
    try {
      const response = await serverEntry.fetch(toWebRequest(req, res));
      sendWebResponse(res, response);
    } catch (error) {
      console.error('[server] Необроблена помилка запиту:', error);
      // Клієнт відпав (aborted request) — писати вже нікуди.
      if (res.destroyed || res.writableEnded) return;
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
