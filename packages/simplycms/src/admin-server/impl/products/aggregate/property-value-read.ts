import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { TRANSLATABLE, loadTranslations } from 'simplycms/translations';
import type { ChildrenOut } from './children-read-schema';
import { withStatuses } from './children-status';

/** Значення властивостей товару й його модифікацій (форма входу `saveDescription`). */
export async function loadPropertyValues(
  db: ActorDb,
  productId: string,
  primary: string,
): Promise<ChildrenOut['propertyValues']> {
  type V = {
    id: string;
    property_id: string;
    kind: ChildrenOut['propertyValues'][number]['kind'];
    option_id: string | null;
    numeric_value: string | null;
    bool_value: boolean | null;
    color_value: string | null;
    modification_id: string | null;
  };
  const values = (
    await db.execute<V>(sql`
      select v.id, v.property_id, coalesce(v.value_kind, p.property_type) as kind, v.option_id,
             v.numeric_value, v.bool_value, v.color_value, null::uuid as modification_id
        from public.product_property_values v
        join public.section_properties p on p.id = v.property_id
       where v.product_id = ${productId}
      union all
      select v.id, v.property_id, coalesce(v.value_kind, p.property_type), v.option_id,
             v.numeric_value, v.bool_value, v.color_value, v.modification_id
        from public.modification_property_values v
        join public.section_properties p on p.id = v.property_id
        join public.product_modifications m on m.id = v.modification_id
       where m.product_id = ${productId}
       order by 1`)
  ).rows;
  const productIds = values
    .filter((v) => !v.modification_id && v.kind === 'text')
    .map((v) => v.id);
  const modIds = values
    .filter((v) => v.modification_id && v.kind === 'text')
    .map((v) => v.id);
  const vText = new Map([
    ...(await loadTranslations(
      db,
      TRANSLATABLE.productPropertyValue,
      productIds,
    )),
    ...(await loadTranslations(
      db,
      TRANSLATABLE.modificationPropertyValue,
      modIds,
    )),
  ]);
  const propertyValues = values.map((v) => {
    const spec = v.modification_id
      ? TRANSLATABLE.modificationPropertyValue
      : TRANSLATABLE.productPropertyValue;
    return {
      id: v.id,
      propertyId: v.property_id,
      kind: v.kind,
      ...(v.option_id && { optionId: v.option_id }),
      ...(v.numeric_value !== null && { number: v.numeric_value }),
      ...(v.bool_value !== null && { bool: v.bool_value }),
      ...(v.color_value !== null && { color: v.color_value }),
      ...(v.modification_id && { modificationId: v.modification_id }),
      ...(v.kind === 'text' && {
        text: Object.fromEntries(
          Object.entries(withStatuses(spec, vText.get(v.id), primary)).map(
            ([l, r]) => [
              l,
              { value: r.values.value ?? null, status: r.status },
            ],
          ),
        ),
      }),
    };
  });
  return propertyValues;
}
