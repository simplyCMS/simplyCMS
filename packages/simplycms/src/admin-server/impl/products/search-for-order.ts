import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';

/** Мінімум символів запиту: коротший не дає корисного звуження каталогу. */
export const MIN_SEARCH_LENGTH = 2;
/** Стеля видачі — діалог додавання показує короткий список, не каталог. */
export const SEARCH_LIMIT = 20;

export const searchProductsForOrderInput = z.object({
  query: z.string().trim().max(100),
});

export interface OrderProductHit {
  productId: string;
  name: string;
  sku: string | null;
  hasModifications: boolean;
}

/**
 * Екранує `\`, `%` і `_` для `ilike … escape '\'`: у запиті адміна вони
 * літерали, а не шаблон. `\` екранується першим розрядом того ж regexp-проходу,
 * тож кінцевий `\` запиту стає `\\` і не з'їдає наступний `%` шаблону.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/**
 * Е5б-4: ВУЗЬКИЙ пошук товару для додавання в замовлення — не загальний
 * пошук адмінки (push-down `like` у `subset.ts` лишається забороненим).
 * Лише активні; збіг за назвою БУДЬ-ЯКОЮ мовою (`product_translations`), `sku`
 * товару або назвою/`sku` його модифікацій (товар повертається один раз — `exists`,
 * не join); `order by name, id`; значення — параметром, escape-символ явний.
 *
 * 🔴 Показана назва — ОСНОВНОЮ мовою (адмін-читач; рішення власника 19, частина
 * товару): менеджер знаходить товар за `en`-назвою, але бачить у списку основну.
 * Колонки `products.name` тут більше нема — джерело правди переклади.
 *
 * 🔴 Запит коротший за 2 символи повертається ДО `runAdmin`: БД не чіпається
 * взагалі (і `requireGrant` теж — порожній список не розкриває даних).
 */
export const searchProductsForOrderOp = async ({
  data,
}: {
  data: z.infer<typeof searchProductsForOrderInput>;
}): Promise<{ items: OrderProductHit[] }> => {
  const { query } = parseAdminInput(searchProductsForOrderInput, data);
  if (query.length < MIN_SEARCH_LENGTH) return { items: [] };
  const pattern = `%${escapeLike(query)}%`;
  return runAdmin('order.manage', async (db) => {
    const result = await db.execute<{
      productId: string;
      name: string;
      sku: string | null;
      hasModifications: boolean;
    }>(sql`
      select p.id as "productId", pt.name, p.sku,
             (coalesce(p.has_modifications, false) or exists (
               select 1 from public.product_modifications m
                where m.product_id = p.id)) as "hasModifications"
        from public.products p
        join public.product_translations pt
          on pt.product_id = p.id
         and pt.locale = (select code from public.languages where is_default)
       where p.is_active
         and (exists (
                select 1 from public.product_translations t
                 where t.product_id = p.id and t.name ilike ${pattern} escape '\\')
              or p.sku ilike ${pattern} escape '\\'
              or exists (
                select 1 from public.product_modifications m
                 where m.product_id = p.id
                   and (m.sku ilike ${pattern} escape '\\'
                        or exists (
                          select 1 from public.product_modification_translations mt
                           where mt.modification_id = m.id
                             and mt.name ilike ${pattern} escape '\\'))))
       order by pt.name, p.id
       limit ${SEARCH_LIMIT}`);
    return { items: result.rows };
  });
};
