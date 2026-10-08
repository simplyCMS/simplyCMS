import { sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type {
  AdminCustomerCursor,
  AdminCustomerPage,
  AdminCustomerRow,
} from 'simplycms/contracts';
import { ORDER_STATUS_CODE } from 'simplycms/contracts/order-status-codes';
import { escapeLike } from '../products/search-for-order';
import { runAdmin } from '../run';
import { isoTs, toDate, toDateOrNull } from './timestamps';
import { parseAdminInput } from '../validation';

export const CUSTOMERS_PAGE_SIZE = 50;

export const listCustomersInput = z.object({
  search: z.string().trim().min(2).max(100).optional(),
  categoryId: z.uuid().optional(),
  role: z.enum(['admin', 'customer']).optional(),
  banned: z.boolean().optional(),
  cursor: z.object({ createdAt: z.date(), id: z.uuid() }).optional(),
});

type Raw = Omit<AdminCustomerRow, 'bannedAt' | 'createdAt'> & {
  bannedAt: string | null;
  createdAt: string;
  createdAtKey: string;
};

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

/**
 * Список покупців для адмінки (`customer.manage`), keyset за
 * `(created_at desc, id desc)` (Е6г-6). База — `users LEFT JOIN profiles`:
 * власник, створений CLI, профілю не має, але в списку є (Review Focus 5).
 *
 * - Категорія ефективна (`coalesce(p.category_id, дефолтна)`), фільтр — за нею.
 * - Агрегати замовлень — та сама умова, що в `loadCustomerStats`: скасовані
 *   не рахуються, `status_id NULL` рахується.
 * - 🔴 Порядок і курсор по `date_trunc('milliseconds', created_at)`: курсор
 *   приходить як JS `Date` (мс), а в БД мікросекунди — порівняння з
 *   неусіченим значенням пропускало б рядки на межі сторінок.
 * - `pageSize` — тестовий шов операції; серверна функція його не передає,
 *   тож клієнт розміром сторінки не керує.
 */
export const listCustomersOp = async ({
  data,
  pageSize = CUSTOMERS_PAGE_SIZE,
}: {
  data: z.input<typeof listCustomersInput>;
  pageSize?: number;
}): Promise<AdminCustomerPage> => {
  const f = parseAdminInput(listCustomersInput, data);
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
      sql`(date_trunc('milliseconds', u.created_at), u.id) <
        (${f.cursor.createdAt.toISOString()}::timestamptz, ${f.cursor.id}::uuid)`,
    );
  const whereSql = where.length
    ? sql`where ${sql.join(where, sql` and `)}`
    : sql``;

  return runAdmin('customer.manage', async (db) => {
    const result = await db.execute<Raw>(sql`
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
       order by date_trunc('milliseconds', u.created_at) desc, u.id desc
       limit ${pageSize + 1}`);
    const page = result.rows.slice(0, pageSize);
    const last = page[page.length - 1];
    const nextCursor: AdminCustomerCursor | null =
      result.rows.length > pageSize && last
        ? { createdAt: toDate(last.createdAtKey), id: last.userId }
        : null;
    return {
      rows: page.map(({ createdAtKey: _key, ...row }) => ({
        ...row,
        bannedAt: toDateOrNull(row.bannedAt),
        createdAt: toDate(row.createdAt),
      })),
      nextCursor,
    };
  });
};
