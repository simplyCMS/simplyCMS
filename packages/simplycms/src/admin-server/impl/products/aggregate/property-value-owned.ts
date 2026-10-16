import { sql } from 'drizzle-orm';
import { AdminConflictError } from 'simplycms/contracts/domain-errors';
import { fail, uuidArray, type ChildCtx } from './children-common';
import type { PropertyValuesInput } from './children-schemas';

type Upsert = NonNullable<PropertyValuesInput['upsert']>[number];
type Owned = { id: string; mine: boolean };

const taken = () =>
  new AdminConflictError('unique', 'property_value_scalar_taken');

/**
 * Рядок значення належить цьому товару: id не чужий і не лежить в іншій
 * таблиці значень (товар ↔ модифікація). Далі скалярна властивість (не
 * multiselect) має один рядок на власника: другий з іншим id — конфлікт.
 * Часткового UNIQUE ще немає (Task 17), тож рубіж — тут.
 */
export async function assertRowsOwned(
  ctx: ChildCtx,
  upserts: readonly Upsert[],
  removing: ReadonlySet<string>,
): Promise<void> {
  if (upserts.length === 0) return;
  const { db, productId } = ctx;
  const ids = uuidArray(upserts.map((u) => u.id));
  const inProduct = await db.execute<Owned>(sql`
    select id, product_id = ${productId} as mine
      from public.product_property_values where id = any(${ids})`);
  const inModification = await db.execute<Owned>(sql`
    select v.id, m.product_id = ${productId} as mine
      from public.modification_property_values v
      join public.product_modifications m on m.id = v.modification_id
     where v.id = any(${ids})`);
  const own = (rows: readonly Owned[]) =>
    new Map(rows.map((r) => [r.id, r.mine]));
  const product = own(inProduct.rows);
  const modification = own(inModification.rows);
  upserts.forEach((u, i) => {
    const here = u.modificationId ? modification : product;
    const there = u.modificationId ? product : modification;
    if (there.has(u.id) || here.get(u.id) === false)
      throw fail(['propertyValues', 'upsert', i, 'id'], 'invalid_value');
  });

  const scalar = upserts.filter((u) => u.kind !== 'multiselect');
  if (scalar.length === 0) return;
  const key = (owner: string | null, property: string) =>
    `${owner ?? ''}|${property}`;
  const wanted = new Set<string>();
  for (const u of scalar) {
    const k = key(u.modificationId ?? null, u.propertyId);
    if (wanted.has(k)) throw taken();
    wanted.add(k);
  }
  const props = uuidArray(scalar.map((u) => u.propertyId));
  const rows = await db.execute<{
    id: string;
    owner: string | null;
    property_id: string;
  }>(sql`
    select id, null::uuid as owner, property_id
      from public.product_property_values
     where product_id = ${productId} and property_id = any(${props})
    union all
    select v.id, v.modification_id, v.property_id
      from public.modification_property_values v
      join public.product_modifications m on m.id = v.modification_id
     where m.product_id = ${productId} and v.property_id = any(${props})`);
  const mine = new Set(upserts.map((u) => u.id));
  for (const r of rows.rows)
    if (
      !mine.has(r.id) &&
      !removing.has(r.id) &&
      wanted.has(key(r.owner, r.property_id))
    )
      throw taken();
}
