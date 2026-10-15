import { sql, type SQL } from 'drizzle-orm';
import { ORDER_STATUS_CODE } from 'simplycms/contracts/order-status-codes';
import { escapeLike } from '../products/search-for-order';
import { isoTs } from '../sql-timestamps';

/**
 * Ключ keyset покупців — єдине джерело виразу в запиті списку. Індекс
 * `users_created_ms_id_idx` (`schema/auth.ts`) мусить збігатися з ним дослівно,
 * інакше планувальник його не візьме; схема лежить нижче за адмін-сервер у
 * тірах, тож імпортувати вираз туди не можна — збіг доводить гейт
 * `customers-list-plan.test.ts` (EXPLAIN справжнього запиту). `at time zone
 * 'UTC'` потрібен, щоб вираз індексу був IMMUTABLE.
 */
export const CUSTOMERS_KEYSET_KEY = sql`date_trunc('milliseconds', u.created_at at time zone 'UTC')`;

/** Умова пошуку: підрядок (з екрануванням) + порівняння цифр телефону. */
function searchClause(search: string): SQL {
  const like = `%${escapeLike(search)}%`;
  const digits = search.replace(/\D/g, '');
  const byDigits =
    digits.length >= 3
      ? sql` or regexp_replace(p.phone, '\\D', '', 'g') like ${`%${digits}%`}`
      : sql``;
  return sql`(u.email ilike ${like} escape '\\' or u.name ilike ${like} escape '\\'
    or p.first_name ilike ${like} escape '\\' or p.last_name ilike ${like} escape '\\'
    or p.phone ilike ${like} escape '\\'${byDigits})`;
}

/** Фільтри списку покупців після Zod-розбору. */
export interface CustomersListFilters {
  search?: string;
  categoryId?: string;
  role?: 'admin' | 'customer';
  banned?: boolean;
  cursor?: { createdAt: Date; id: string };
}

/** SQL списку покупців: сторінка `pageSize + 1` рядків (зайвий — ознака курсора). */
export function buildCustomersListSql(
  f: CustomersListFilters,
  pageSize: number,
): SQL {
  const defaultCategory = sql`(select id from public.user_categories where is_default limit 1)`;
  const isAdmin = sql`exists (select 1 from public.user_roles ur
    where ur.user_id = u.id and ur.role = 'admin')`;
  const where: SQL[] = [];
  if (f.search) where.push(searchClause(f.search));
  if (f.categoryId)
    where.push(
      sql`coalesce(p.category_id, ${defaultCategory}) = ${f.categoryId}`,
    );
  if (f.role === 'admin') where.push(isAdmin);
  if (f.role === 'customer') where.push(sql`not ${isAdmin}`);
  if (f.banned === true) where.push(sql`u.banned_at is not null`);
  if (f.banned === false) where.push(sql`u.banned_at is null`);
  if (f.cursor)
    where.push(
      sql`(${CUSTOMERS_KEYSET_KEY}, u.id) <
        (${f.cursor.createdAt.toISOString()}::timestamptz at time zone 'UTC', ${f.cursor.id}::uuid)`,
    );
  const whereSql = where.length
    ? sql`where ${sql.join(where, sql` and `)}`
    : sql``;

  return sql`
      select u.id as "userId", u.email,
             coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
                      nullif(u.name, '')) as name,
             p.phone,
             c.id as "categoryId", c.name as "categoryName",
             agg.cnt as "ordersCount", agg.cents as "ordersTotalCents",
             ${isAdmin} as "isAdmin", ${isoTs(sql`u.banned_at`)} as "bannedAt",
             ${isoTs(sql`u.created_at`)} as "createdAt",
             ${isoTs(sql`date_trunc('milliseconds', u.created_at)`)} as "createdAtKey"
        from public.users u
        left join public.profiles p on p.user_id = u.id
        left join public.user_categories c
          on c.id = coalesce(p.category_id, ${defaultCategory})
        cross join lateral (
          select count(*)::int as cnt,
                 round(coalesce(sum(o.total), 0) * 100)::float8 as cents
            from public.orders o
            left join public.order_statuses s on s.id = o.status_id
           where o.user_id = u.id
             and s.code is distinct from ${ORDER_STATUS_CODE.cancelled}) agg
        ${whereSql}
       order by ${CUSTOMERS_KEYSET_KEY} desc, u.id desc
       limit ${pageSize + 1}`;
}
