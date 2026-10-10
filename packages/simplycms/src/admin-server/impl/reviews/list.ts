import { sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type {
  AdminReviewCursor,
  AdminReviewPage,
  AdminReviewRow,
} from 'simplycms/contracts';
import { REVIEW_STATUSES } from 'simplycms/contracts';
import { runAdmin } from '../run';
import { isoTs, toDate } from '../sql-timestamps';
import { parseAdminInput } from '../validation';

export const REVIEWS_PAGE_SIZE = 50;

export const listReviewsInput = z.object({
  status: z.enum(REVIEW_STATUSES).optional(),
  cursor: z.object({ createdAt: z.date(), id: z.uuid() }).optional(),
});

type Raw = Omit<AdminReviewRow, 'createdAt'> & {
  createdAt: string;
  createdAtKey: string;
};

/**
 * Список відгуків для модерації (`review.moderate`), keyset за
 * `(created_at desc, id desc)` — той самий патерн, що `listCustomersOp`.
 *
 * - 🔴 Порядок і курсор по `date_trunc('milliseconds', created_at)`: курсор
 *   приходить як JS `Date` (мс), а в БД мікросекунди.
 * - Автор — `LEFT JOIN`: відгук покупця, якого видалено, лишається з
 *   `user_id NULL` і `authorName/authorEmail = null`.
 * - `imagesCount` не падає на `NULL`/не-масиві (`jsonb` без CHECK форми).
 * - `pageSize` — тестовий шов; серверна функція його не передає.
 */
export const listReviewsOp = async ({
  data,
  pageSize = REVIEWS_PAGE_SIZE,
}: {
  data: z.input<typeof listReviewsInput>;
  pageSize?: number;
}): Promise<AdminReviewPage> => {
  const f = parseAdminInput(listReviewsInput, data);
  const where: SQL[] = [];
  if (f.status) where.push(sql`r.status = ${f.status}`);
  if (f.cursor)
    where.push(
      sql`(date_trunc('milliseconds', r.created_at), r.id) <
        (${f.cursor.createdAt.toISOString()}::timestamptz, ${f.cursor.id}::uuid)`,
    );
  const whereSql = where.length
    ? sql`where ${sql.join(where, sql` and `)}`
    : sql``;

  return runAdmin('review.moderate', async (db) => {
    const result = await db.execute<Raw>(sql`
      select r.id, r.product_id as "productId", p.name as "productName",
             r.user_id as "userId",
             coalesce(nullif(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''),
                      u.name) as "authorName",
             u.email as "authorEmail", r.rating, r.title, r.status,
             case when jsonb_typeof(r.images) = 'array'
                  then jsonb_array_length(r.images) else 0 end as "imagesCount",
             ${isoTs(sql`r.created_at`)} as "createdAt",
             ${isoTs(sql`date_trunc('milliseconds', r.created_at)`)} as "createdAtKey"
        from public.product_reviews r
        join public.products p on p.id = r.product_id
        left join public.users u on u.id = r.user_id
        left join public.profiles pr on pr.user_id = u.id
        ${whereSql}
       order by date_trunc('milliseconds', r.created_at) desc, r.id desc
       limit ${pageSize + 1}`);
    const page = result.rows.slice(0, pageSize);
    const last = page[page.length - 1];
    const nextCursor: AdminReviewCursor | null =
      result.rows.length > pageSize && last
        ? { createdAt: toDate(last.createdAtKey), id: last.id }
        : null;
    return {
      rows: page.map(({ createdAtKey: _key, ...row }) => ({
        ...row,
        createdAt: toDate(row.createdAt),
      })),
      nextCursor,
    };
  });
};

/**
 * Лічильник «очікують» для бейджа: окремий запит, не похідний від списку, тож
 * фільтр списку його не змінює.
 */
export const countPendingReviewsOp = async (): Promise<{ pending: number }> =>
  runAdmin('review.moderate', async (db) => {
    const result = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from public.product_reviews where status = 'pending'`,
    );
    return { pending: result.rows[0]?.n ?? 0 };
  });
