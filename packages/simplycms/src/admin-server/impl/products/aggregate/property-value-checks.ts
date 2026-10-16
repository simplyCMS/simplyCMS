import { sql } from 'drizzle-orm';
import type { ChildCtx } from './children-common';
import { fail, uuidArray } from './children-common';
import type { PropertyKind, PropertyValuesInput } from './children-schemas';

type Upsert = NonNullable<PropertyValuesInput['upsert']>[number];

export interface ValueRefs {
  /** `section_properties.property_type` за id властивості. */
  readonly kinds: ReadonlyMap<string, PropertyKind>;
  /** `property_options.property_id` за id опції. */
  readonly optionOwner: ReadonlyMap<string, string>;
}

/** Типи властивостей і власники опцій одним читанням (для звірки до запису). */
export async function loadRefs(
  ctx: Pick<ChildCtx, 'db'>,
  upserts: readonly Upsert[],
): Promise<ValueRefs> {
  if (upserts.length === 0) return { kinds: new Map(), optionOwner: new Map() };
  const props = await ctx.db.execute<{ id: string; t: PropertyKind }>(
    sql`select id, property_type as t from public.section_properties
         where id = any(${uuidArray(upserts.map((u) => u.propertyId))})`,
  );
  const optionIds = upserts.flatMap((u) => (u.optionId ? [u.optionId] : []));
  const opts = await ctx.db.execute<{ id: string; property_id: string }>(
    sql`select id, property_id from public.property_options
         where id = any(${uuidArray(optionIds)})`,
  );
  return {
    kinds: new Map(props.rows.map((r) => [r.id, r.t])),
    optionOwner: new Map(opts.rows.map((r) => [r.id, r.property_id])),
  };
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
 * Тип значення збігається з типом властивості, заповнена рівно потрібна колонка,
 * опція належить властивості, `text` — лише для `kind = 'text'`.
 */
export function checkShape(
  u: Upsert,
  refs: ValueRefs,
  at: (...rest: string[]) => (string | number)[],
): void {
  const kind = refs.kinds.get(u.propertyId);
  if (!kind) throw fail(at('propertyId'), 'invalid_value');
  if (kind !== u.kind) throw fail(at('kind'), 'invalid_value');
  const wanted = COLUMN_OF[u.kind];
  for (const field of VALUE_FIELDS) {
    const present = u[field] !== undefined;
    if (field === wanted && !present) throw fail(at(field), 'invalid_type');
    if (field !== wanted && present) throw fail(at(field), 'unrecognized_keys');
  }
  if (u.text !== undefined && u.kind !== 'text')
    throw fail(at('text'), 'unrecognized_keys');
  if (u.optionId && refs.optionOwner.get(u.optionId) !== u.propertyId)
    throw fail(at('optionId'), 'invalid_value');
}
