// Прямий SQL гейта С-8 (`showcase-seed.test.ts`) — незалежний від ядра:
// статус береться за `code`, а не за id, який віддає операція.
import { getTableColumns } from 'drizzle-orm';
import { ORDER_COLUMN_PRIVACY } from 'simplycms/commerce';
import { orders } from 'simplycms/schema';

const NOT_CANCELLED = `(s.code is distinct from 'cancelled')`;
const ADDRESS = `o.shipping_data #>> '{destination,kind}' = 'address'`;
const DAY = `round(extract(epoch from now() - o.created_at) / 86400)::int`;

export type Volume = Record<
  | 'sections'
  | 'products'
  | 'productsWithoutImages'
  | 'priceTypes'
  | 'pickupPoints'
  | 'productsWithoutStock'
  | 'buyers'
  | 'guestOrders'
  | 'courierOrders'
  | 'pickupOrders'
  | 'reviews'
  | 'approvedReviews'
  | 'foreignEmails',
  number
>;

export const VOLUME = `
  select (select count(*)::int from public.sections) as sections,
         (select count(*)::int from public.products) as products,
         (select count(*)::int from public.products
           where jsonb_array_length(coalesce(images, '[]')) = 0) as "productsWithoutImages",
         (select count(*)::int from public.price_types) as "priceTypes",
         (select count(*)::int from public.pickup_points) as "pickupPoints",
         (select count(*)::int from public.products p where not exists (
            select 1 from public.stock_by_pickup_point st
              left join public.product_modifications m on m.id = st.modification_id
             where coalesce(st.product_id, m.product_id) = p.id)) as "productsWithoutStock",
         (select count(*)::int from public.users where email like 'buyer-%') as buyers,
         (select count(*)::int from public.orders
           where user_id is null and personal_data_erased_at is null) as "guestOrders",
         (select count(*)::int from public.orders where pickup_point_id is null) as "courierOrders",
         (select count(*)::int from public.orders where pickup_point_id is not null) as "pickupOrders",
         (select count(*)::int from public.product_reviews) as reviews,
         (select count(*)::int from public.product_reviews where status = 'approved') as "approvedReviews",
         (select count(*)::int from (
            select email from public.users union all
            select email from public.orders where email is not null) e
           where e.email not like '%@showcase.test') as "foreignEmails"`;

export const BY_STATUS = `
  select s.code, count(*)::int as n
    from public.orders o join public.order_statuses s on s.id = o.status_id
   group by s.code`;

export const PRODUCT_IMAGE_REFS = `
  select jsonb_array_elements_text(images) as ref from public.products order by 1`;

export type Revenue = Record<
  | 'newOrders'
  | 'r7'
  | 'r30'
  | 'cancelled30'
  | 'r30WithCancelled'
  | 'olderThan7d'
  | 'maxDay',
  number
>;

const cents = (where: string) =>
  `round(coalesce(sum(o.total) filter (where ${where}), 0) * 100)::int`;

export const REVENUE = `
  select count(*) filter (where s.code = 'new')::int as "newOrders",
         ${cents(`o.created_at >= now() - interval '7 days' and ${NOT_CANCELLED}`)} as r7,
         ${cents(`o.created_at >= now() - interval '30 days' and ${NOT_CANCELLED}`)} as r30,
         ${cents(`o.created_at >= now() - interval '30 days' and s.code = 'cancelled'`)} as cancelled30,
         ${cents(`o.created_at >= now() - interval '30 days'`)} as "r30WithCancelled",
         count(*) filter (where o.created_at < now() - interval '7 days'
                            and ${NOT_CANCELLED})::int as "olderThan7d",
         max(${DAY})::int as "maxDay"
    from public.orders o left join public.order_statuses s on s.id = o.status_id`;

/** Покупці, яких у VIP перевело саме автоправило (`rule_id`) і які там є. */
export const VIP_BY_RULE = `
  select distinct u.email
    from public.user_category_history h
    join public.users u on u.id = h.user_id
    join public.user_categories c on c.id = h.to_category_id and c.code = 'vip'
    join public.profiles pr on pr.user_id = u.id and pr.category_id = c.id
   where h.rule_id is not null`;

export type Category = {
  code: string;
  locked: boolean;
  byRule: number;
  orders: number;
};

export const CATEGORY_OF = `
  select c.code, pr.category_locked as locked,
         (select count(*)::int from public.user_category_history h
           where h.user_id = u.id and h.rule_id is not null) as "byRule",
         (select count(*)::int from public.orders o
            left join public.order_statuses s on s.id = o.status_id
           where o.user_id = u.id and ${NOT_CANCELLED}) as orders
    from public.users u
    join public.profiles pr on pr.user_id = u.id
    join public.user_categories c on c.id = pr.category_id
   where u.email = $1`;

/**
 * ПД стертих замовлень: колонки — з реєстру `ORDER_COLUMN_PRIVACY` (нова
 * `personal` колонка потрапляє сюди сама), знімок доставки — місто й адреса
 * АДРЕСНОЇ доставки (точка видачі — не ПД, знеособлення її не чіпає).
 */
export function erasedOrders(): string {
  const cols = getTableColumns(orders);
  const personal = Object.entries(ORDER_COLUMN_PRIVACY)
    .filter(([key, p]) => p === 'personal' && key !== 'shippingData')
    .map(([key]) => `o."${cols[key as keyof typeof cols].name}"`);
  return `
    select ${personal.join(', ')},
           case when ${ADDRESS} then o.shipping_data #>> '{destination,city}' end as ship_city,
           case when ${ADDRESS} then o.shipping_data #>> '{destination,address}' end as ship_address
      from public.orders o where o.personal_data_erased_at is not null`;
}

/** Усі статуси магазину — кожен мусить трапитися в сіді (С-4). */
export const ALL_STATUSES = [
  'cancelled',
  'confirmed',
  'delivered',
  'new',
  'processing',
  'shipped',
];

export type Deleted = Record<'users' | 'anonReviews' | 'addressErased', number>;

/** Видалений покупець ($1 — його email): слід лишився лише знеособленим. */
export const DELETED = `
  select (select count(*)::int from public.users where email = $1) as users,
         (select count(*)::int from public.product_reviews
           where user_id is null) as "anonReviews",
         (select count(*)::int from public.orders o
           where o.personal_data_erased_at is not null and ${ADDRESS}) as "addressErased"`;
