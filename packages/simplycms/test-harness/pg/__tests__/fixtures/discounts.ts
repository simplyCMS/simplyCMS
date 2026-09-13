// Один ланцюг знижки для харнесу (К2-Е0): group → discount → умова за
// категорією → ціль. До цього файлу showcase тримав його інлайном, а тест
// воронки скопіював би вдруге.

export interface PercentDiscountSpec {
  /** Група знижок; створюється, якщо ще немає (кілька знижок в одній групі). */
  group: string;
  name: string;
  percent: number;
  isActive?: boolean;
  /** Код типу ціни, до якого прив'язана знижка. */
  priceTypeCode?: string;
  /** Код категорії покупця для умови `user_category in […]`; без нього — для всіх. */
  categoryCode?: string;
  target: { type: 'all' } | { type: 'product'; slug: string };
}

export function percentDiscountStatements(s: PercentDiscountSpec): string[] {
  const priceType = s.priceTypeCode ?? 'retail';
  const out = [
    `insert into public.discount_groups (id, name, operator, is_active)
     select gen_random_uuid(), '${s.group}', 'and', true
      where not exists (select 1 from public.discount_groups where name = '${s.group}')`,
    `insert into public.discounts
       (id, name, group_id, discount_type, discount_value, is_active, price_type_id)
     select gen_random_uuid(), '${s.name}', g.id, 'percent', ${s.percent}, ${s.isActive ?? true}, pt.id
       from public.discount_groups g
       cross join public.price_types pt
      where g.name = '${s.group}' and pt.code = '${priceType}'`,
  ];
  if (s.categoryCode) {
    out.push(
      `insert into public.discount_conditions (id, discount_id, condition_type, operator, value)
       select gen_random_uuid(), d.id, 'user_category', 'in',
              to_jsonb(array[(select id::text from public.user_categories where code = '${s.categoryCode}')])
         from public.discounts d where d.name = '${s.name}'`,
    );
  }
  out.push(
    s.target.type === 'all'
      ? `insert into public.discount_targets (id, discount_id, target_type, target_id)
         select gen_random_uuid(), d.id, 'all', null from public.discounts d
          where d.name = '${s.name}'`
      : `insert into public.discount_targets (id, discount_id, target_type, target_id)
         select gen_random_uuid(), d.id, 'product', p.id
           from public.discounts d cross join public.products p
          where d.name = '${s.name}' and p.slug = '${s.target.slug}'`,
  );
  return out;
}
