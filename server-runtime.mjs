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

/**
 * Origin сайту з `VITE_SITE_URL` (Р18б): єдине джерело origin запиту.
 *
 * Лише `http:`/`https:` і лише абсолютний URL — порожній чи відносний origin
 * зламав би CSRF-перевірку Start і базу посилань auth. Значення в тексті
 * помилки НЕ друкуємо (воно може містити облікові дані в userinfo).
 */
export function parseSiteOrigin(raw) {
  let url;
  try {
    url = new URL(String(raw ?? ''));
  } catch {
    url = null;
  }
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    throw new Error(
      'VITE_SITE_URL не задано або це не абсолютний http(s)-URL: ' +
        'раннер будує URL запиту лише з нього',
    );
  }
  return url.origin;
}

/**
 * Шлях і query з request-target або `null`, якщо target неприйнятний.
 *
 * Origin-form мусить починатися рівно з одного `/`: `//evil/x` Start
 * сприйняв би як protocol-relative і відповів би 308 на чужий хост (S3-04),
 * `/\evil` браузери читають так само. Absolute-form (`http://h/p?q`)
 * зводимо до шляху й query — хост із нього ніколи не береться.
 */
export function requestPath(target) {
  if (typeof target !== 'string') return null;
  let path = target;
  if (/^https?:\/\//i.test(target)) {
    try {
      const url = new URL(target);
      path = url.pathname + url.search;
    } catch {
      return null;
    }
  }
  if (!path.startsWith('/') || path[1] === '/' || path[1] === '\\') {
    return null;
  }
  return path;
}

/**
 * Абсолютний URL запиту: origin з конфігу + шлях і query з request-target.
 *
 * 🔴 `Host`, `X-Forwarded-Host` і `X-Forwarded-Proto` для URL ігноруються
 * ЗОВСІМ: їх підробляє клієнт, а origin з `request.url` далі бере CSRF-перевірка
 * Start і Better Auth. Прапорця «довіряти проксі» немає свідомо.
 */
export function toRequestUrl(req, siteOrigin) {
  const path = requestPath(req.url ?? '/');
  if (path === null) throw new RangeError('Неприйнятний request-target');
  const url = new URL(siteOrigin + path);
  if (url.origin !== siteOrigin) throw new RangeError('Чужий origin у шляху');
  return url.toString();
}

/** Стеля тіла за замовчуванням, байти (1 МіБ): auth, роути, не-multipart serverFn. */
export const DEFAULT_BODY_LIMIT = 1_048_576;

/**
 * Стеля multipart на server function, байти (26 МіБ).
 *
 * 🔴 Дзеркало `MAX_REQUEST_BODY_BYTES` (`simplycms/domain/media`: 5 фото
 * відгуку по 5 МіБ + 1 МіБ службових): раннер ядро не імпортує, тож рівність
 * стереже тест парності.
 */
export const SERVER_FN_BODY_LIMIT = 27_262_976;

/**
 * Стеля тіла запиту за класом. Велика — лише `multipart/form-data` на ТОЧНИЙ
 * сирий префікс server functions; закодований шлях (`/%5FserverFn/…`) отримує
 * малу: помилка в безпечний бік.
 */
export function bodyLimitFor(req, serverFnBase) {
  const path = requestPath(req.url ?? '/') ?? '';
  const type = String(req.headers['content-type'] ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  return path.startsWith(serverFnBase) && type === 'multipart/form-data'
    ? SERVER_FN_BODY_LIMIT
    : DEFAULT_BODY_LIMIT;
}

/** Тіло відмови 413 — той самий машинний код, що в `checkBodyLimit` ядра. */
export const PAYLOAD_TOO_LARGE_CODE = 'request/payload-too-large';

/**
 * Лічильник байтів між сокетом і `Request`: понад стелю — помилка стріму й
 * знищення зʼєднання. Єдина стеля для chunked (без `Content-Length`).
 */
function limitStream(source, limit, onExceed) {
  let seen = 0;
  return source.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > limit) {
          onExceed();
          controller.error(new RangeError('Тіло запиту перевищує стелю'));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
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
 * server functions (читати ПІСЛЯ імпорту бандла: Start ставить
 * `TSS_SERVER_FN_BASE` сам).
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
 * Відмова за `Content-Length` понад стелю класу — ДО виклику хендлера й без
 * читання тіла. Зʼєднання не закриваємо (поведінка Task 7): клієнт, що ще
 * шле тіло, читає 413, а не обрив. Повертає `true`, якщо відповідь віддано.
 */
export function rejectOversizedBody(req, res, serverFnBase) {
  if (req.method === 'GET' || req.method === 'HEAD') return false;
  const raw = req.headers['content-length'];
  if (raw === undefined) return false;
  const length = Number(raw);
  if (
    Number.isFinite(length) &&
    length >= 0 &&
    length <= bodyLimitFor(req, serverFnBase)
  ) {
    return false;
  }
  res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(PAYLOAD_TOO_LARGE_CODE);
  return true;
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
