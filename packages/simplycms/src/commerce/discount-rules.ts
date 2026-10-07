import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import type { DiscountRules } from 'simplycms/domain/discounts';
import { parseDiscountRules } from './discount-rules-parse';

export { parseDiscountRules } from './discount-rules-parse';

/**
 * ВСІ групи й ВСІ знижки магазину з цілями й умовами (Е6в-8) — плоскими
 * правилами, з яких `buildDiscountForest` будує ліс під тип ціни.
 *
 * 🔴 ОДИН SQL-вираз (CTE + `json_agg`), а не кілька SELECT-ів: один вираз
 * бачить один знімок навіть у READ COMMITTED. Окремі запити між собою бачили
 * `saveDiscount`, і знижка складалася зі старого рядка й нових умов — стану,
 * якого не було жодної миті. REPEATABLE READ не береться: чекаут пише
 * залишки, і `40001` зʼявився б у записуваному шляху.
 *
 * 🔴 Активність і тип ціни тут НЕ фільтруються — це робить `buildDiscountForest`
 * (неактивна група падає разом із піддеревом, чого предикат у SQL не вміє).
 * RLS на цих таблицях немає, тож забутий фільтр не впав би — він тихо роздав
 * би вимкнену акцію; тому фільтр живе в одному місці під тестом.
 *
 * `discount_value` їде рядком (`::text`): numeric у JSON-числі втратив би
 * точність мовчки, а розбір рядка — явний і падає на сміття.
 */
export async function loadDiscountRules(db: ActorDb): Promise<DiscountRules> {
  const result = await db.execute<{ rules: unknown }>(sql`
    with grp as (
      select coalesce(json_agg(json_build_object(
               'id', g.id, 'name', g.name, 'description', g.description,
               'operator', g.operator, 'is_active', g.is_active,
               'priority', g.priority, 'starts_at', g.starts_at,
               'ends_at', g.ends_at, 'parent_group_id', g.parent_group_id
             ) order by g.priority, g.id), '[]'::json) as list
        from public.discount_groups g
    ),
    tgt as (
      select t.discount_id, json_agg(json_build_object(
               'id', t.id, 'target_type', t.target_type, 'target_id', t.target_id
             ) order by t.id) as list
        from public.discount_targets t group by t.discount_id
    ),
    cnd as (
      select c.discount_id, json_agg(json_build_object(
               'id', c.id, 'condition_type', c.condition_type,
               'operator', c.operator, 'value', c.value
             ) order by c.id) as list
        from public.discount_conditions c group by c.discount_id
    ),
    dsc as (
      select coalesce(json_agg(json_build_object(
               'id', d.id, 'group_id', d.group_id, 'name', d.name,
               'description', d.description, 'discount_type', d.discount_type,
               'discount_value', d.discount_value::text, 'priority', d.priority,
               'is_active', d.is_active, 'starts_at', d.starts_at,
               'ends_at', d.ends_at, 'price_type_id', d.price_type_id,
               'targets', coalesce(tgt.list, '[]'::json),
               'conditions', coalesce(cnd.list, '[]'::json)
             ) order by d.priority, d.id), '[]'::json) as list
        from public.discounts d
        left join tgt on tgt.discount_id = d.id
        left join cnd on cnd.discount_id = d.id
    )
    select json_build_object('groups', grp.list, 'discounts', dsc.list) as rules
      from grp, dsc`);
  return parseDiscountRules(result.rows[0]?.rules);
}
