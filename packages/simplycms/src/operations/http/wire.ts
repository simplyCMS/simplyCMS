import { z } from 'zod';

/**
 * Дротова дата для ВХОДУ операцій: на дроті ISO-рядок (`format: date-time` в
 * OpenAPI), у `run` — `Date`. Кодек, а не `z.date()`: `z.date()` не має
 * JSON-схеми, тож `buildOpenApi` відмовив би (Date у схемі заборонений).
 */
export const wireDate = z.codec(z.iso.datetime(), z.date(), {
  decode: (iso) => new Date(iso),
  encode: (date) => date.toISOString(),
});

/**
 * Відповідь операції → JSON-значення дроту: `Date` стає ISO-рядком, `undefined`
 * у масивах/полях зникає як у `JSON.stringify`. Одна функція і для тіла, і для
 * збереженої ідемпотентної відповіді, щоб повтор віддав байт-у-байт те саме.
 */
export function toWire(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? null));
}
