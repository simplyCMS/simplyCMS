/**
 * Стеля тіла запиту production-runner-а (Р20): клас стелі за запитом,
 * відмова за `Content-Length` і лічильник байтів chunked-потоку.
 *
 * Самодостатній модуль (ядро не імпортується — Е8-Р7′); 26 МіБ тут — літерал,
 * парність із `MAX_REQUEST_BODY_BYTES` стереже `tests/server-body-limit.test.mjs`.
 */
import { requestPath } from './server-origin.mjs';

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
export function limitStream(source, limit, onExceed) {
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
