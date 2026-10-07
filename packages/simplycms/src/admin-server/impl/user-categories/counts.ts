import { sql } from 'drizzle-orm';
import { runAdmin } from '../run';

export type CategoryCustomerCount = {
  categoryId: string;
  customers: number;
};

/**
 * Кількість покупців у кожній категорії (список категорій адмінки, Task 9).
 * Категорія без покупців — рядок із `0`, а не відсутній рядок.
 *
 * 🔴 Профіль з `category_id NULL` рахується в ДЕФОЛТНУ категорію — так його
 * оцінюють і автоправила, і ціна (Е6в-19); інакше список показував би
 * «Роздріб: 0» при сотнях покупців без явної категорії.
 */
export const countCustomersByCategoryOp = async (): Promise<
  CategoryCustomerCount[]
> =>
  runAdmin('customer.manage', async (db) => {
    const result = await db.execute<CategoryCustomerCount>(sql`
      select c.id as "categoryId", count(p.id)::int as customers
        from public.user_categories c
        left join public.profiles p
          on p.category_id = c.id or (p.category_id is null and c.is_default)
       group by c.id
       order by c.id`);
    return result.rows;
  });
