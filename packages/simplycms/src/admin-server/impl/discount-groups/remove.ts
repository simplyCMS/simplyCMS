import { asc, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { discountGroups } from 'simplycms/schema';
import { lockCatalogTarget } from '../catalog-lock';
import { DISCOUNT_CONFIG_LOCK } from '../discount-lock';
import { runAdmin } from '../run';
import { assertAllFound } from '../shipping-lock';

export const removeDiscountGroupsInput = z
  .array(z.object({ id: z.uuid() }))
  .min(1)
  .max(100);

/**
 * Видалення груп знижок разом із піддеревом (Е6в-15):
 *  1. `DISCOUNT_CONFIG_LOCK` — ПЕРШИЙ запит (серіалізує з перевішуванням,
 *     guard циклу якого бачить піддерево).
 *  2. Запитані рядки `FOR UPDATE … ORDER BY id`; відсутній id — помилка й
 *     ROLLBACK усього batch-у.
 *  3. Один DELETE по всьому піддереву (рекурсивний CTE). Знижки груп, їхні
 *     цілі й умови йдуть FK-каскадом.
 *
 * Повертає id УСІХ видалених груп — колекція прибирає їх write-back-ом
 * (каскад БД інакше лишив би в ній осиротілих нащадків).
 */
export const removeDiscountGroupsOp = async ({
  data,
}: {
  data: z.infer<typeof removeDiscountGroupsInput>;
}) =>
  runAdmin('discount.manage', async (db) => {
    await lockCatalogTarget(db, DISCOUNT_CONFIG_LOCK);
    const ids = data.map((d) => d.id);
    const found = await db
      .select({ id: discountGroups.id })
      .from(discountGroups)
      .where(inArray(discountGroups.id, ids))
      .orderBy(asc(discountGroups.id))
      .for('update');
    assertAllFound('discount_groups', ids, found);
    const roots = sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    const result = await db.execute<{ id: string }>(sql`
      with recursive sub(id) as (
        select id from public.discount_groups where id in (${roots})
        union
        select g.id from public.discount_groups g join sub on g.parent_group_id = sub.id
      )
      delete from public.discount_groups where id in (select id from sub)
      returning id`);
    return { removed: result.rows.map((r) => r.id) };
  });
