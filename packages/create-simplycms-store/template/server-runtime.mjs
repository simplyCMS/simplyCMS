/**
 * Node-шар production-runner-а: `IncomingMessage → Request` і стрімінг
 * web-`Response` назад у `ServerResponse`.
 *
 * Винесено з `server.mjs` окремим модулем, щоб покрити регресійними тестами
 * без збірки (`server.mjs` імпортує `dist/server/server.js`). Модуль
 * САМОДОСТАТНІЙ — імпортує лише `node:*`, тож його байт-у-байт копія лежить
 * поруч із шаблоном скретч-магазину (`tests/pilot/store-template/`).
 */
import { Readable, pipeline } from 'node:stream';

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

/** Абсолютний URL запиту з урахуванням reverse-proxy заголовків. */
export function toRequestUrl(req) {
  const proto = req.headers['x-forwarded-proto'] ?? 'http';
  const host =
    req.headers['x-forwarded-host'] ??
    req.headers.host ??
    `localhost:${req.socket?.localPort ?? 80}`;
  return new URL(req.url ?? '/', `${proto}://${host}`).toString();
}

/**
 * `IncomingMessage` → web `Request` (тіло — стрімом, без буферизації).
 *
 * 🔴 `signal` обовʼязковий: `renderRouterToStream` віддає його React-у
 * (`renderToReadableStream({ signal })`). Без нього розрив зʼєднання клієнтом
 * не зупиняє SSR-рендер — сервер догенеровує сторінку «в нікуди».
 * Слухаємо `close` саме на відповіді: `close` на запиті прилітає одразу після
 * зчитування (у GET — тіла немає взагалі), тож абортив би живий рендер.
 */
export function toWebRequest(req, res) {
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });
  return new Request(toRequestUrl(req), {
    method: req.method,
    headers: toWebHeaders(req.headers),
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? 'half' : undefined,
    signal: controller.signal,
  });
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
