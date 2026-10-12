import { createMiddleware } from '@tanstack/react-start';
import {
  LENGTH_REQUIRED_CODE,
  MAX_REQUEST_BODY_BYTES,
  PAYLOAD_TOO_LARGE_CODE,
} from 'simplycms/domain/media';

// UPSTREAM:START-BODY-1 — docs/architecture/upstream-workarounds.md
/**
 * Стеля тіла POST на server functions.
 *
 * `@tanstack/start-server-core` читає тіло повністю й без лімітів:
 * `request.formData()` для multipart І для urlencoded (перевірка через
 * `includes`), `request.json()` для JSON. Анонімний клієнт міг би змусити
 * сервер буферизувати гігабайти. Request-міддлвара виконується ДО обробника
 * server function, тож відмовляє за заголовком, не читаючи тіла.
 *
 * 🔴 Це перевірка `Content-Length`, а не підрахунок байтів потоку: Node-раннер
 * (`server.mjs`) обмежує тіло саме заявленою довжиною. Тому POST БЕЗ
 * `Content-Length` (chunked) проходить лише з медіатипом `application/json`,
 * який Start НЕ читає як форму; усе, що Start прочитав би як форму, і будь-що
 * не-JSON → 411. Інший рантайм або проксі без цієї гарантії — привід
 * переглянути.
 *
 * 🔴 Відкрите вікно: chunked JSON не має стелі, а Start буферизує
 * `request.json()` повністю. Це свідомо прийнятий архітектором залишковий
 * ризик (не «обмежене аргументами server function»: клієнт сам обирає розмір).
 */
const DEFAULT_SERVER_FN_BASE = '/_serverFn/';

/**
 * База шляху server functions. Start виводить її з `basepath` і
 * `serverFns.base` та віддає в рантаймі як `process.env.TSS_SERVER_FN_BASE`
 * (із завершальним `/`). Читається лише в момент запиту, на сервері: модуль
 * потрапляє й у клієнтський граф через `start.ts`. Літерал мовчки вимкнув би
 * стелю в магазині з власним `basepath`.
 */
function serverFnBase(): string {
  return process.env.TSS_SERVER_FN_BASE || DEFAULT_SERVER_FN_BASE;
}

/** Текстове тіло з `content-type`: без нього клієнт Start не прочитає код. */
function reject(status: number, code: string): Response {
  return new Response(code, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

/**
 * Дзеркало предиката Start (`server-functions-handler.js`, ~28-53): тіло
 * читається як форма, якщо `content-type` ЛИШЕ МІСТИТЬ multipart/form-data чи
 * x-www-form-urlencoded — навіть у параметрі (`application/json; x=multipart/…`).
 * Звіряти при кожному бампі Start (UPSTREAM:START-BODY-1).
 */
function startReadsAsForm(contentType: string): boolean {
  return (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  );
}

/** Чи можна пропустити POST без `Content-Length`: лише чистий JSON, який Start не читає як форму. */
function isUnboundedJsonAllowed(request: Request): boolean {
  const raw = (request.headers.get('content-type') ?? '').toLowerCase();
  if (startReadsAsForm(raw)) return false;
  return (raw.split(';')[0] ?? '').trim() === 'application/json';
}

/** Чиста функція (юніт без підйому Start): `Response` відмови або `null`. */
export function checkBodyLimit(request: Request): Response | null {
  if (request.method.toUpperCase() !== 'POST') return null;
  if (!new URL(request.url).pathname.startsWith(serverFnBase())) return null;

  const raw = request.headers.get('content-length');
  if (raw === null) {
    return isUnboundedJsonAllowed(request)
      ? null
      : reject(411, LENGTH_REQUIRED_CODE);
  }
  const length = Number(raw);
  if (
    !Number.isFinite(length) ||
    length < 0 ||
    length > MAX_REQUEST_BODY_BYTES
  ) {
    return reject(413, PAYLOAD_TOO_LARGE_CODE);
  }
  return null;
}

/** Request-міддлвара для `createStart({ requestMiddleware })`, після CSRF. */
export const bodyLimitMiddleware = createMiddleware().server(
  ({ next, request }) => checkBodyLimit(request) ?? next(),
);
