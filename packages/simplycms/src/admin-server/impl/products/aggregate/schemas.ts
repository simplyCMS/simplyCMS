import { z } from 'zod';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import { isRichField } from 'simplycms/domain/translations';
import { sanitizeNullableRichHtml } from 'simplycms/sanitize';
import {
  TRANSLATABLE,
  fieldFromWire,
  fieldToWire,
} from 'simplycms/translations';
import { code } from '../../languages/view';

// Схеми й перетворення вводу/виводу агрегата товару (М1, Task 11). На дроті
// поля camelCase; у реєстрі перекладів і в `source_hashes` — колонки БД.

const SPEC = TRANSLATABLE.product;
const optText = (max: number) => z.string().max(max).nullable().optional();

/** Тексти однієї мови. Невідоме поле — відмова (`strict`), а не мовчазне відкидання. */
export const productTexts = z.strictObject({
  name: optText(500),
  shortDescription: optText(5_000),
  description: optText(200_000),
  metaTitle: optText(500),
  metaDescription: optText(1_000),
});
export type ProductTexts = z.infer<typeof productTexts>;

export const textsByLocale = z.record(code, productTexts);
export const stockStatus = z.enum(['in_stock', 'out_of_stock', 'on_order']);

/** Неперекладна основа товару. */
export const productBase = z.strictObject({
  sectionId: z.uuid().nullable().optional(),
  sku: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  hasModifications: z.boolean().optional(),
  stockStatus: stockStatus.optional(),
});
export type ProductBase = z.infer<typeof productBase>;

export const fieldStatus = z.enum(['current', 'outdated', 'missing']);
/** Рядок `texts` у `products.get`: значення полів + статуси відносно джерела. */
export const textsRow = z.object({
  name: z.string().nullable(),
  shortDescription: z.string().nullable(),
  description: z.string().nullable(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  status: fieldStatus,
  fieldStatus: z.record(z.string(), fieldStatus),
});
export type TextsRow = z.infer<typeof textsRow>;

export const versionOut = z.object({ version: z.number().int() });

/** Вхід `expectedVersion` — обов'язковий у кожній команді агрегата (спека §18.3). */
export const expectedVersion = z.number().int().min(1);

/**
 * Wire → поля реєстру (`short_description`…), rich-поля санітизуються ДО плану:
 * хеш береться від очищеної розмітки (майстер §3.4), а `<script>` чи порожній
 * після очищення вміст стає `null`.
 */
export function toPatch(
  texts: ProductTexts,
): Record<string, string | null | undefined> {
  const out: Record<string, string | null | undefined> = {};
  for (const [name, value] of Object.entries(texts)) {
    const field = fieldFromWire(SPEC, name)!;
    out[field] =
      typeof value === 'string' && isRichField(SPEC, field)
        ? sanitizeNullableRichHtml(value, 'content')
        : value;
  }
  return out;
}

/** Мапа «мова → патч» для плану; порожні патчі не потрапляють. */
export function toPatchMap(
  texts: Readonly<Record<string, ProductTexts>> | undefined,
): Map<string, Record<string, string | null | undefined>> {
  const map = new Map<string, Record<string, string | null | undefined>>();
  for (const [locale, t] of Object.entries(texts ?? {}))
    map.set(locale, toPatch(t));
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
  record: Readonly<Record<string, T>>,
  at: readonly string[],
): Record<string, T> {
  const out: Record<string, T> = {};
  const unknown: string[] = [];
  for (const [name, v] of Object.entries(record)) {
    const f = fieldFromWire(SPEC, name);
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
