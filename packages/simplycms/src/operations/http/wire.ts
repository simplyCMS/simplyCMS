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

/**
 * Відповідь операції → дротова форма, ЗВІРЕНА з вихідною схемою `def.output`.
 * OpenAPI обіцяє клієнтам саме цю схему, тож адаптер її стереже: поле не за
 * схемою — помилка (500 `internal` без деталей), зайві поля відсікаються (не
 * витікає зайве з рядка БД). Одна функція і для тіла, і для збереженої
 * ідемпотентної відповіді: повтор віддає те саме.
 */
export function encodeOutput(schema: z.ZodType, value: unknown): unknown {
  const parsed = schema.safeParse(toWire(value));
  if (!parsed.success)
    throw new Error(
      '[simplycms/operations] вихід операції не відповідає схемі',
    );
  return parsed.data;
}
