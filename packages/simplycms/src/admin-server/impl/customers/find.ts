import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { escapeLike, SEARCH_LIMIT } from '../products/search-for-order';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';

export const findCustomersInput = z.object({
  query: z.string().trim().min(2).max(100),
});

export type CustomerHit = {
  userId: string;
  email: string;
  name: string | null;
  /** Категорія профілю; профіль без категорії — дефолтна (Е6в-19). */
  categoryName: string | null;
};

/**
 * Вузький пошук покупця за email або імʼям (`customer.manage`) — для
 * діагностики ціни (Task 10), не загальний список покупців. Значення —
 * параметром, `ilike … escape '\'`; не більше 20 рядків, `order by email`.
 *
 * Email — `users.email` (джерело Better Auth); `accounts`/`users` доступні
 * лише `app_admin`, тож пошук — операція адмінки.
 */
export const findCustomersOp = async ({
  data,
}: {
  data: z.infer<typeof findCustomersInput>;
}): Promise<CustomerHit[]> => {
  const { query } = parseAdminInput(findCustomersInput, data);
  const pattern = `%${escapeLike(query)}%`;
  return runAdmin('customer.manage', async (db) => {
    const result = await db.execute<CustomerHit>(sql`
      select u.id as "userId", u.email,
             nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '') as name,
             coalesce(c.name, d.name) as "categoryName"
        from public.users u
        join public.profiles p on p.user_id = u.id
        left join public.user_categories c on c.id = p.category_id
        left join public.user_categories d
          on d.is_default and p.category_id is null
       where u.email ilike ${pattern} escape '\\'
          or p.first_name ilike ${pattern} escape '\\'
          or p.last_name ilike ${pattern} escape '\\'
          or concat_ws(' ', p.first_name, p.last_name) ilike ${pattern} escape '\\'
       order by u.email, u.id
       limit ${SEARCH_LIMIT}`);
    return result.rows;
  });
};
