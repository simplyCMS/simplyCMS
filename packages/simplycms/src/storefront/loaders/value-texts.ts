import { sql } from 'drizzle-orm';
import { TRANSLATABLE, withFallback } from 'simplycms/translations';
import type { ActorDb } from './db';
import {
  toPropertyValueRow,
  type ProductPropertyValueRow,
  type RawPropertyValueRow,
} from './property-values';

/** Власник значення: товар чи модифікація (різні таблиці значень і перекладів). */
export type ValueOwner = 'product' | 'modification';

const OWNER = {
  product: {
    table: sql.raw('public.product_property_values'),
    spec: TRANSLATABLE.productPropertyValue,
  },
  modification: {
    table: sql.raw('public.modification_property_values'),
    spec: TRANSLATABLE.modificationPropertyValue,
  },
} as const;

/**
 * Тексти значень властивостей у мові запиту: `id значення → текст` (мова,
 * інакше основна — `withFallback`). Текст живе лише в перекладах (Р18), тож
 * нетекстові значення тут просто отримують `null`.
 */
export async function loadProductValueTexts(
  db: ActorDb,
  owner: ValueOwner,
  valueIds: readonly string[],
  locale: string,
  primary: string,
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (valueIds.length === 0) return out;
  const { table, spec } = OWNER[owner];
  const fb = withFallback(spec, locale, primary);
  const res = await db.execute<{ value_id: string; value: string | null }>(sql`
    select v.id as value_id, ${fb.columns.value} as value
      from ${table} v ${fb.joinOn(sql`v.id`)}
     where v.id in (${sql.join(
       valueIds.map((id) => sql`${id}::uuid`),
       sql`, `,
     )})`);
  for (const r of res.rows) out.set(r.value_id, r.value);
  return out;
}

/** Рядки значень картки зі значеннями за типом (текст — з перекладів). */
export function withValueTexts(
  rows: readonly RawPropertyValueRow[],
  texts: ReadonlyMap<string, string | null>,
): ProductPropertyValueRow[] {
  return rows.map((row) => toPropertyValueRow(row, texts.get(row.value_id)));
}
