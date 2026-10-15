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
 * 🔴 Це другий рубіж, а не єдиний: першу стелю (1 МіБ усюди, 26 МіБ лише для
 * multipart на serverFn) тримає Node-раннер `server.mjs` на ВСІ шляхи —
 * за `Content-Length` і лічильником байтів chunked-потоку. Тут тип обробника
 * дає сам Start (`handlerType`), а не сирий шлях: `/%5FserverFn/…` Start
 * нормалізує до server function, тож предикат за `pathname` його б пропустив.
 * POST БЕЗ `Content-Length` проходить лише з `application/json`, який Start НЕ
 * читає як форму; усе, що Start прочитав би як форму, і будь-що не-JSON → 411.
 * Chunked JSON більше не безмежний: його обмежує лічильник раннера. Інший
 * рантайм (не `server.mjs`) цієї гарантії не має — переглянути.
 */

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
export function checkBodyLimit(
  request: Request,
  handlerType: 'serverFn' | 'router',
): Response | null {
  if (request.method.toUpperCase() !== 'POST') return null;
  if (handlerType !== 'serverFn') return null;

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
  ({ next, request, handlerType }) =>
    checkBodyLimit(request, handlerType) ?? next(),
);
