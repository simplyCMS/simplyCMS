import { z } from 'zod';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import {
  fieldToWire,
  isRichField,
  type TranslatableSpec,
} from 'simplycms/domain/translations';
import { sanitizeNullableRichHtml } from 'simplycms/sanitize';
import { fieldFromWire } from 'simplycms/translations';

// Перетворення вводу/виводу перекладного агрегата. На дроті поля camelCase; у реєстрі
// перекладів і в `source_hashes` — колонки БД.

export const versionOut = z.object({ version: z.number().int() });

/** Вхід `expectedVersion` — обов'язковий у кожній команді агрегата (спека §18.3). */
export const expectedVersion = z.number().int().min(1);

export const fieldStatus = z.enum(['current', 'outdated', 'missing']);

/**
 * Рядок `texts` у `get`: значення полів (nullable) + статуси відносно джерела.
 * Поля беруться з ключів схеми вводу `texts`.
 */
export function textsRowSchema<S extends z.ZodRawShape>(texts: z.ZodObject<S>) {
  const fields = Object.fromEntries(
    Object.keys(texts.shape).map((k) => [k, z.string().nullable()]),
  ) as { [K in keyof S]: z.ZodNullable<z.ZodString> };
  return z.object(fields).extend({
    status: fieldStatus,
    fieldStatus: z.record(z.string(), fieldStatus),
  });
}

/** Тип рядка `texts` у `get` для схеми вводу `texts` зі формою `S`. */
export type TextsRowOf<S extends z.ZodRawShape> = z.infer<
  ReturnType<typeof textsRowSchema<S>>
>;

type Patch = Record<string, string | null | undefined>;

/**
 * Wire → поля реєстру (`short_description`…), rich-поля санітизуються ДО плану:
 * хеш береться від очищеної розмітки (майстер §3.4), а `<script>` чи порожній
 * після очищення вміст стає `null`.
 */
export function toPatch(
  spec: TranslatableSpec,
  texts: Readonly<Record<string, string | null | undefined>>,
): Patch {
  const out: Patch = {};
  for (const [name, value] of Object.entries(texts)) {
    const field = fieldFromWire(spec, name)!;
    out[field] =
      typeof value === 'string' && isRichField(spec, field)
        ? sanitizeNullableRichHtml(value, 'content')
        : value;
  }
  return out;
}

/** Мапа «мова → патч» для плану; порожні патчі не потрапляють. */
export function toPatchMap(
  spec: TranslatableSpec,
  texts:
    | Readonly<
        Record<string, Readonly<Record<string, string | null | undefined>>>
      >
    | undefined,
): Map<string, Patch> {
  const map = new Map<string, Patch>();
  for (const [locale, t] of Object.entries(texts ?? {}))
    map.set(locale, toPatch(spec, t));
  return map;
}

/** Поля реєстру → ключі дроту (`source_hashes`, поточні хеші, статуси). */
export function toWireKeys<T>(
  record: Readonly<Record<string, T>>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).map(([f, v]) => [fieldToWire(f), v]),
  );
}

/** Ключі дроту → поля реєстру; невідоме поле — `unrecognized_keys`. */
export function fromWireKeys<T>(
  spec: TranslatableSpec,
  record: Readonly<Record<string, T>>,
  at: readonly string[],
): Record<string, T> {
  const out: Record<string, T> = {};
  const unknown: string[] = [];
  for (const [name, v] of Object.entries(record)) {
    const f = fieldFromWire(spec, name);
    if (f) out[f] = v;
    else unknown.push(name);
  }
  if (unknown.length > 0)
    throw new ValidationError([{ path: [...at], code: 'unrecognized_keys' }]);
  return out;
}

/**
 * Відмова плану (шляхи `[мова, поле]`) → шляхи входу: `texts.<мова>.<поле>`, а
 * для однієї мови (`dropLocale`) — `fields.<поле>`.
 */
export function remapPlanIssues<T>(
  prefix: readonly (string | number)[],
  run: () => T,
  dropLocale = false,
): T {
  try {
    return run();
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    throw new ValidationError(
      error.issues.map((i) => {
        const path = dropLocale ? i.path.slice(1) : i.path;
        return {
          ...i,
          path: [
            ...prefix,
            ...path.map((seg, n) =>
              n === path.length - 1 && typeof seg === 'string'
                ? fieldToWire(seg)
                : seg,
            ),
          ],
        };
      }),
    );
  }
}
