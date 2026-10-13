/**
 * Node-шар production-runner-а: `IncomingMessage → Request` і стрімінг
 * web-`Response` назад у `ServerResponse`.
 *
 * Origin/request-target — `server-origin.mjs`, стеля тіла — `server-body-limit.mjs`.
 *
 * Винесено з `server.mjs` окремим модулем, щоб покрити регресійними тестами
 * без збірки (`server.mjs` імпортує `dist/server/server.js`). Модуль
 * САМОДОСТАТНІЙ — імпортує лише `node:*`, тож його байт-у-байт копія лежить
 * поруч із шаблоном скретч-магазину (`tests/pilot/store-template/`).
 */
import { Readable, pipeline } from 'node:stream';

import {
  bodyLimitFor,
  limitStream,
  rejectOversizedBody,
} from './server-body-limit.mjs';
import { requestPath, toRequestUrl } from './server-origin.mjs';

/** `IncomingMessage.headers` → web `Headers` (масиви розкладаємо в append). */
export function toWebHeaders(nodeHeaders) {
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

/**
 * `IncomingMessage` → web `Request` (тіло — стрімом, з лічильником байтів).
 *
 * 🔴 `signal` обовʼязковий: `renderRouterToStream` віддає його React-у
 * (`renderToReadableStream({ signal })`). Без нього розрив зʼєднання клієнтом
 * не зупиняє SSR-рендер — сервер догенеровує сторінку «в нікуди».
 * Слухаємо `close` саме на відповіді: `close` на запиті прилітає одразу після
 * зчитування (у GET — тіла немає взагалі), тож абортив би живий рендер.
 *
 * `options.origin` — з `parseSiteOrigin`; `options.serverFnBase` — префікс
 * server functions — іменований експорт `SERVER_FN_BASE` бандла (Start
 * інлайнить базу Vite define-ом, у `process.env` її немає).
 */
export function toWebRequest(req, res, options) {
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });
  const limit = bodyLimitFor(req, options.serverFnBase);
  return new Request(toRequestUrl(req, options.origin), {
    method: req.method,
    headers: toWebHeaders(req.headers),
    body: hasBody
      ? limitStream(Readable.toWeb(req), limit, () => req.socket?.destroy())
      : undefined,
    duplex: hasBody ? 'half' : undefined,
    signal: controller.signal,
  });
}

/**
 * Перші відмови до sirv і хендлера (одне джерело для `server.mjs` і тестів):
 * поганий request-target → 400 (Р18б), `Content-Length` понад стелю → 413
 * (Р20). `extraHeaders` — заголовки безпеки (Р27) для цих відповідей.
 * Повертає `true`, якщо відповідь уже віддано.
 */
export function rejectBadRequest(req, res, serverFnBase, extraHeaders = {}) {
  if (requestPath(req.url) === null) {
    res.writeHead(400, {
      ...extraHeaders,
      'content-type': 'text/plain; charset=utf-8',
    });
    res.end('Bad Request');
    return true;
  }
  return rejectOversizedBody(req, res, serverFnBase, extraHeaders);
}

/**
 * Стрімить web `Response` у `ServerResponse` (SSR у Start — потоковий).
 *
 * 🔴 `pipeline`, а не `.pipe()`: тіло може впасти вже ПІСЛЯ заголовків
 * (router-core озброює `Stream lifetime exceeded` на 60 с, плюс помилки
 * серіалізації). `.pipe()` не вішає слухача `error` на джерело — така помилка
 * стає unhandled `'error'` і вбиває Node-процес. `pipeline` знищує обидва боки
 * і віддає помилку в колбек.
 */
export function sendWebResponse(res, response) {
  // Клієнт міг відпасти, доки готувалась відповідь: у знищений `res` не пишемо
  // (інакше `pipeline` кидає ERR_STREAM_UNABLE_TO_PIPE), а тіло відпускаємо.
  if (res.destroyed || res.writableEnded) {
    response.body?.cancel().catch(() => {});
    return;
  }

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
  pipeline(Readable.fromWeb(response.body), res, (error) => {
    if (!error) return;
    console.error('[server] Помилка стріму відповіді:', error);
    res.destroy(error);
  });
}
