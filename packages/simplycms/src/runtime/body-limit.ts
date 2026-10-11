import { createMiddleware } from '@tanstack/react-start';
import {
  LENGTH_REQUIRED_CODE,
  MAX_REQUEST_BODY_BYTES,
  PAYLOAD_TOO_LARGE_CODE,
} from '../domain/media';

// UPSTREAM:START-BODY-1 — docs/architecture/upstream-workarounds.md
/**
 * Стеля тіла POST на server functions.
 *
 * `@tanstack/start-server-core` для multipart безумовно робить
 * `await request.formData()` без жодних лімітів: анонімний клієнт міг би
 * змусити сервер буферизувати гігабайти. Request-міддлвара виконується ДО
 * обробника server function, тож відмовляє за заголовком, не читаючи тіла.
 *
 * 🔴 Це перевірка `Content-Length`, а не підрахунок байтів потоку: Node-раннер
 * (`server.mjs`) обмежує тіло саме заявленою довжиною. Тому multipart БЕЗ
 * `Content-Length` (chunked) відхиляється 411 — інакше стелю можна обійти.
 * Інший рантайм або проксі без цієї гарантії — привід переглянути.
 * JSON без заголовка проходить як є: його розмір обмежений на практиці
 * розміром серіалізованих аргументів, а multipart — ні.
 */
const SERVER_FN_PREFIX = '/_serverFn/';

/** Текстове тіло з `content-type`: без нього клієнт Start не прочитає код. */
function reject(status: number, code: string): Response {
  return new Response(code, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

/** Чиста функція (юніт без підйому Start): `Response` відмови або `null`. */
export function checkBodyLimit(request: Request): Response | null {
  if (request.method.toUpperCase() !== 'POST') return null;
  if (!new URL(request.url).pathname.startsWith(SERVER_FN_PREFIX)) return null;

  const raw = request.headers.get('content-length');
  if (raw === null) {
    const type = request.headers.get('content-type') ?? '';
    return type.toLowerCase().startsWith('multipart/')
      ? reject(411, LENGTH_REQUIRED_CODE)
      : null;
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
