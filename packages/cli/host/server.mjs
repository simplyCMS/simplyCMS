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
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseEnv } from 'node:util';
import sirv from 'sirv';

import { sendWebResponse, toWebRequest } from './server-runtime.mjs';

// Контракт серверного env (спека CLI v1 §7): єдине джерело для серверного
// коду — `process.env`, а `.env`-файли лише НАПОВНЮЮТЬ його перед стартом
// (це не fallback, а спосіб наповнення єдиного джерела; їхня відсутність —
// норма). Пріоритет: реальний env процесу > `.env.local` > `.env` — тому
// пишемо лише відсутні ключі, а `.env.local` читаємо першим. Файли шукаються
// в теці запуску (для `pnpm start` — корінь магазину). Наслідок контракту:
// ротація Supabase-ключів = перезапуск процесу, без перезбірки.
for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  const parsed = parseEnv(readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (!(key in process.env)) process.env[key] = value;
  }
}

// Динамічний імпорт ПІСЛЯ наповнення env: статичний хоістився б вище циклу,
// і модуль-рівневий код збірки виконався б до того, як env готовий.
const { default: serverEntry } = await import('./dist/server/server.js');

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
