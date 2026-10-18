import { sql } from 'drizzle-orm';
import type { ChildCtx } from './children-common';
import { fail, uuidArray } from './children-common';
import type { PropertyKind, PropertyValuesInput } from './children-schemas';

type Upsert = NonNullable<PropertyValuesInput['upsert']>[number];

/**
 * Наявні властивості з входу одним читанням (рання помилка поля `propertyId`).
 *
 * 🔴 `FOR KEY SHARE` у транзакції запису (команда агрегата): той самий замок, який потім
 * візьме складений FK значення, тож порядок замків не змінюється. Без нього паралельне
 * видалення властивості між цим SELECT і вставкою дало б 23503 складеного FK — і хибну
 * помилку поля `kind` замість `propertyId`. З ним видалення або чекає на запис значення,
 * або (якщо почалося раніше) цей SELECT дочекається його коміту й рядка не побачить.
 */
export async function loadKnownProperties(
  ctx: Pick<ChildCtx, 'db'>,
  upserts: readonly Upsert[],
): Promise<ReadonlySet<string>> {
  if (upserts.length === 0) return new Set();
  const props = await ctx.db.execute<{ id: string }>(
    sql`select id from public.section_properties
         where id = any(${uuidArray(upserts.map((u) => u.propertyId))})
         order by id
           for key share`,
  );
  return new Set(props.rows.map((r) => r.id));
}

/** Яку колонку значення дозволяє тип (Р18: рівно одна, `text` — жодної). */
const COLUMN_OF: Readonly<Record<PropertyKind, string | null>> = {
  select: 'optionId',
  multiselect: 'optionId',
  number: 'number',
  range: 'number',
  boolean: 'bool',
  color: 'color',
  text: null,
};
const VALUE_FIELDS = ['optionId', 'number', 'bool', 'color'] as const;

/**
 * Форма вводу: властивість існує, заповнена рівно колонка свого `kind`, `text` — лише
 * для `kind = 'text'`. Звірку `kind` ↔ `property_type` і власника опції тримає БД
 * (складені FK, І6/І7): їхню відмову команда перекладає в ту саму помилку поля
 * (`property-value-write.ts`), а друга копія правила в коді лише розійшлася б з першою.
 * Наявність властивості лишається тут: відсутня властивість порушила б ТОЙ САМИЙ
 * складений FK, що й чужий тип, і як окрема помилка `propertyId` не розрізнялася б.
 */
export function checkShape(
  u: Upsert,
  known: ReadonlySet<string>,
  at: (...rest: string[]) => (string | number)[],
): void {
  if (!known.has(u.propertyId)) throw fail(at('propertyId'), 'invalid_value');
  const wanted = COLUMN_OF[u.kind];
  for (const field of VALUE_FIELDS) {
    const present = u[field] !== undefined;
    if (field === wanted && !present) throw fail(at(field), 'invalid_type');
    if (field !== wanted && present) throw fail(at(field), 'unrecognized_keys');
  }
  if (u.text !== undefined && u.kind !== 'text')
    throw fail(at('text'), 'unrecognized_keys');
}
