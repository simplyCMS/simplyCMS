// Один ланцюг знижки для харнесу (К2-Е0): group → discount → умова → ціль.
// До цього файлу showcase тримав його інлайном, а тест воронки скопіював би
// вдруге. К3-Е6в: тип ціни `null` («для всіх»), оператор і вкладеність груп,
// порогова умова — для лісу знижок і ядра `priceCart`.

type GroupOperator = 'and' | 'or' | 'not' | 'min' | 'max';

export interface DiscountGroupSpec {
  name: string;
  operator?: GroupOperator;
  isActive?: boolean;
  priority?: number;
  /** Назва батьківської групи — вкладена група. */
  parent?: string;
}

export interface PercentDiscountSpec {
  /** Група знижок; створюється, якщо ще немає (кілька знижок в одній групі). */
  group: string;
  /** Оператор групи, якщо вона створюється цим викликом. */
  operator?: GroupOperator;
  /** Батьківська група, якщо група створюється цим викликом. */
  parentGroup?: string;
  name: string;
  percent: number;
  priority?: number;
  isActive?: boolean;
  /** Код типу ціни знижки; `null` — для всіх типів (Е6в-2). */
  priceTypeCode?: string | null;
  /** Код категорії покупця для умови `user_category in […]`; без нього — для всіх. */
  categoryCode?: string;
  /** Порогова умова (`min_quantity`/`min_order_amount`). */
  threshold?: {
    type: 'min_quantity' | 'min_order_amount';
    operator: string;
    value: number;
  };
  target: { type: 'all' } | { type: 'product'; slug?: string; id?: string };
}

/** Група за назвою; повторний виклик з тією самою назвою нічого не робить. */
export function discountGroupStatement(g: DiscountGroupSpec): string {
  const parent = g.parent
    ? `(select id from public.discount_groups where name = '${g.parent}')`
    : 'null';
  return `insert into public.discount_groups (id, name, operator, is_active, priority, parent_group_id)
     select gen_random_uuid(), '${g.name}', '${g.operator ?? 'and'}', ${g.isActive ?? true},
            ${g.priority ?? 0}, ${parent}
      where not exists (select 1 from public.discount_groups where name = '${g.name}')`;
}

export function percentDiscountStatements(s: PercentDiscountSpec): string[] {
  const code = s.priceTypeCode === undefined ? 'retail' : s.priceTypeCode;
  // Невідомий код не має мовчки дати NULL («для всіх»): join, як і раніше,
  // тоді просто не вставить знижку.
  const [priceType, priceJoin] =
    code === null
      ? ['null::uuid', '']
      : ['pt.id', `cross join public.price_types pt`];
  const priceWhere = code === null ? '' : ` and pt.code = '${code}'`;
  const byName = `from public.discounts d where d.name = '${s.name}'`;
  const out = [
    discountGroupStatement({
      name: s.group,
      operator: s.operator,
      parent: s.parentGroup,
    }),
    `insert into public.discounts
       (id, name, group_id, discount_type, discount_value, priority, is_active, price_type_id)
     select gen_random_uuid(), '${s.name}', g.id, 'percent', ${s.percent},
            ${s.priority ?? 0}, ${s.isActive ?? true}, ${priceType}
       from public.discount_groups g ${priceJoin}
      where g.name = '${s.group}'${priceWhere}`,
  ];
  if (s.categoryCode) {
    out.push(
      `insert into public.discount_conditions (id, discount_id, condition_type, operator, value)
       select gen_random_uuid(), d.id, 'user_category', 'in',
              to_jsonb(array[(select id::text from public.user_categories where code = '${s.categoryCode}')])
         ${byName}`,
    );
  }
  if (s.threshold) {
    const { type, operator, value } = s.threshold;
    out.push(
      `insert into public.discount_conditions (id, discount_id, condition_type, operator, value)
       select gen_random_uuid(), d.id, '${type}', '${operator}', '${value}'::jsonb ${byName}`,
    );
  }
  const t = s.target;
  const product = t.type === 'product' && t.id ? `'${t.id}'::uuid` : null;
  out.push(
    t.type === 'all'
      ? `insert into public.discount_targets (id, discount_id, target_type, target_id)
         select gen_random_uuid(), d.id, 'all', null ${byName}`
      : product
        ? `insert into public.discount_targets (id, discount_id, target_type, target_id)
           select gen_random_uuid(), d.id, 'product', ${product} ${byName}`
        : `insert into public.discount_targets (id, discount_id, target_type, target_id)
           select gen_random_uuid(), d.id, 'product', p.id
             from public.discounts d cross join public.products p
            where d.name = '${s.name}' and p.slug = '${t.slug}'`,
  );
  return out;
}
