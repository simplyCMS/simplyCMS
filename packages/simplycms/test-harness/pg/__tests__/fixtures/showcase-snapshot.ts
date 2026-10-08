// Нормалізований знімок засіяної бази для гейта детермінованості С-8(б).
//
// 🔴 Без uuid і `ref` медіа (С-6: ключ генерує викликач — `randomUUID`), без
// абсолютного часу: дата — це день-зсув від `now()` (сід триває секунди, тож
// округлення до доби дає рівно день-зсув PRNG). Звʼязки — через людські
// ключі (назва, email, вміст замовлення), а не через id. Кожен запит
// впорядкований повністю, тож рівність знімків = рівність даних.
import type { SeededShowcase } from './showcase-seed';

const DAY = `round(extract(epoch from now() - %s) / 86400)::int`;
const day = (col: string) => DAY.replace('%s', col);

const QUERIES = {
  sections: `select name, slug from public.sections order by slug`,
  products: `select p.name, p.slug, s.slug as section,
                    jsonb_array_length(coalesce(p.images, '[]')) as images,
                    (select count(*)::int from public.product_modifications m
                      where m.product_id = p.id) as modifications
               from public.products p left join public.sections s on s.id = p.section_id
              order by p.slug`,
  prices: `select p.slug, m.name as modification, t.name as type, pp.price::text, pp.old_price::text
             from public.product_prices pp
             join public.products p on p.id = pp.product_id
             join public.price_types t on t.id = pp.price_type_id
             left join public.product_modifications m on m.id = pp.modification_id
            order by 1, 2 nulls first, 3`,
  // Рядок модифікації має `product_id NULL` — товар береться через неї.
  stock: `select pt.name as point, p.slug, m.name as modification, s.quantity
            from public.stock_by_pickup_point s
            join public.pickup_points pt on pt.id = s.pickup_point_id
            left join public.product_modifications m on m.id = s.modification_id
            join public.products p on p.id = coalesce(s.product_id, m.product_id)
           order by 1, 2, 3 nulls first`,
  users: `select u.email, u.name, (u.banned_at is not null) as banned,
                 c.code as category, pr.category_locked as locked
            from public.users u
            left join public.profiles pr on pr.user_id = u.id
            left join public.user_categories c on c.id = pr.category_id
           order by u.email`,
  // `order_number` випадковий (не PRNG сіду) — замовлення впізнається за
  // вмістом: позиції згорнуті в рядок, порядок — за всіма колонками.
  orders: `select ${day('o.created_at')} as day, o.email, s.code as status,
                  o.total::text, o.shipping_cost::text, sm.name as shipping,
                  pt.name as point, (o.personal_data_erased_at is not null) as erased,
                  (select jsonb_agg(jsonb_build_array(i.name, i.quantity, i.price::text, i.total::text)
                                    order by i.name, i.quantity, i.price)
                     from public.order_items i where i.order_id = o.id) as items
             from public.orders o
             left join public.order_statuses s on s.id = o.status_id
             left join public.shipping_methods sm on sm.id = o.shipping_method_id
             left join public.pickup_points pt on pt.id = o.pickup_point_id
            order by 1 desc, 2 nulls first, 3, 4, 5, 6, 7, 8, 9`,
  reviews: `select p.slug, u.email, r.rating, r.title, r.status
              from public.product_reviews r
              join public.products p on p.id = r.product_id
              left join public.users u on u.id = r.user_id
             order by 1, 2 nulls first, 3, 4, 5`,
  history: `select u.email, h.from_category_name, h.to_category_name,
                   (h.rule_id is not null) as by_rule, (h.changed_by is not null) as by_admin,
                   ${day('h.created_at')} as day
              from public.user_category_history h
              left join public.users u on u.id = h.user_id
             order by 1, 6 desc, 2, 3, 4, 5`,
  discounts: `select name, discount_type::text as type, discount_value::text as value, is_active
                from public.discounts order by name`,
  media: `select entity_type, mime_type, count(*)::int as n
            from public.media group by 1, 2 order by 1, 2`,
} as const;

export type ShowcaseSnapshot = Record<keyof typeof QUERIES, unknown[]>;

export async function showcaseSnapshot(
  s: SeededShowcase,
): Promise<ShowcaseSnapshot> {
  const out = {} as ShowcaseSnapshot;
  for (const [key, sql] of Object.entries(QUERIES)) {
    out[key as keyof typeof QUERIES] = await s.rows(sql);
  }
  return out;
}
