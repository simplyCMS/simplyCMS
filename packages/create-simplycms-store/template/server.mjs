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

import { parseSiteOrigin } from './server-origin.mjs';
import {
  rejectBadRequest,
  sendWebResponse,
  toWebRequest,
} from './server-runtime.mjs';

// Контракт серверного env (спека CLI v1 §7): єдине джерело для серверного
// коду — `process.env`, а `.env`-файли лише НАПОВНЮЮТЬ його перед стартом
// (це не fallback, а спосіб наповнення єдиного джерела; їхня відсутність —
// норма). Пріоритет: реальний env процесу > `.env.local` > `.env` — тому
// пишемо лише відсутні ключі, а `.env.local` читаємо першим. Файли шукаються
// в теці запуску (для `pnpm start` — корінь магазину). Наслідок контракту:
// ротація серверних ключів (`DATABASE_URL`, `BETTER_AUTH_SECRET`) =
// перезапуск процесу, без перезбірки.
//
// 🔴 Ключі, які start.mjs прибирає з оточення сервера (пароль власника схеми),
// з файлів НЕ підтягуються: інакше `.env.local` повернув би їх у процес, що
// пережив `execve`. Дубль списку з `scripts/start-core.mjs` (`STRIPPED_ENV`) —
// парність двох списків стереже `tests/start-core.test.ts`.
const STRIPPED_ENV = ['MIGRATION_DATABASE_URL'];
for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  const parsed = parseEnv(readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (STRIPPED_ENV.includes(key)) continue;
    if (!(key in process.env)) process.env[key] = value;
  }
}

// 🔴 Р16: `server.mjs` — прод-раннер зібраного бандла за визначенням, тож
// ставить `NODE_ENV=production` безумовно (як `next start`), а не чекає, що
// власник його задасть: від цього залежать попередження про пошту, прод-збірка
// react у рантаймі й режим log-драйвера. Змішаного режиму не буває (для dev є
// `vite`). Лише присвоєння в `process.env` — ядро тут не імпортується (Е8-Р7′).
if (process.env.NODE_ENV && process.env.NODE_ENV !== 'production') {
  console.warn(
    `NODE_ENV=${process.env.NODE_ENV} проігноровано: server.mjs завжди production`,
  );
}
process.env.NODE_ENV = 'production';

// Р18б: origin запиту — лише з `VITE_SITE_URL` (заголовки Host/X-Forwarded-*
// клієнт підробляє, а origin з `request.url` бере CSRF-перевірка Start і
// Better Auth). Без валідного значення старт неможливий — до `listen`.
let SITE_ORIGIN;
try {
  SITE_ORIGIN = parseSiteOrigin(process.env.VITE_SITE_URL);
} catch (error) {
  console.error(`[server] ${error.message}`);
  process.exit(1);
}

// Динамічний імпорт ПІСЛЯ наповнення env: статичний хоістився б вище циклу,
// і модуль-рівневий код збірки виконався б до того, як env готовий.
//
// Перевірку груп env драйверів робить сам серверний бандл на верхньому рівні
// `src/server.ts` (Е8-Р7′): `server.mjs` не залежить від ядра, тож стартує і в
// корені монорепо. Часткова група (забутий S3_REGION) кидає помилку під час
// імпорту → виходимо ДО listen. Клас помилки живе в бандлі, тому впізнаємо за
// `code`, а не `instanceof`; для неї стек не друкуємо (лише імена ключів).
let bundle;
try {
  bundle = await import('./dist/server/server.js');
} catch (error) {
  if (error?.code === 'SIMPLYCMS_DRIVER_ENV') console.error(error.message);
  else console.error('[server] Не вдалося завантажити сервер:', error);
  process.exit(1);
}
const serverEntry = bundle.default;

// 🔴 Префікс server functions — іменований експорт бандла (`src/server.ts`,
// Р20′): Start ІНЛАЙНИТЬ `TSS_SERVER_FN_BASE` у збірку через Vite define, у
// `process.env` раннера змінної немає. Від бази залежить, який запит отримує
// велику стелю тіла (multipart на serverFn). Мовчазного фолбеку на дефолт
// немає: старий host-файл без експорту дав би малу стелю на нестандартній базі.
const SERVER_FN_BASE = bundle.SERVER_FN_BASE;
if (typeof SERVER_FN_BASE !== 'string' || !SERVER_FN_BASE.startsWith('/')) {
  console.error(
    '[server] Бандл не експортує SERVER_FN_BASE: онови host-файли (`simplycms update --write`) і перезбери.',
  );
  process.exit(1);
}

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
  // Р18б/Р20: поганий request-target (400) і `Content-Length` понад стелю
  // (413) — до sirv і хендлера, для ВСІХ шляхів.
  if (rejectBadRequest(req, res, SERVER_FN_BASE)) return;
  serveStatic(req, res, async () => {
    try {
      const response = await serverEntry.fetch(
        toWebRequest(req, res, {
          origin: SITE_ORIGIN,
          serverFnBase: SERVER_FN_BASE,
        }),
      );
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
