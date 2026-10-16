import { sql } from 'drizzle-orm';
import { fail, uuidArray, type ChildCtx } from './children-common';
import type { ModificationsInput } from './children-schemas';

type Upsert = NonNullable<ModificationsInput['upsert']>[number];

/** Модифікації товару: id, що вже існують (для розрізнення «нова/наявна»). */
export async function modificationIdsOf(
  ctx: Pick<ChildCtx, 'db' | 'productId'>,
): Promise<Set<string>> {
  const res = await ctx.db.execute<{ id: string }>(
    sql`select id from public.product_modifications where product_id = ${ctx.productId}`,
  );
  return new Set(res.rows.map((r) => r.id));
}

/** Модифікації ПІСЛЯ команди (для перевірки значень і зображень). */
export const modificationIdsAfter = (
  existing: ReadonlySet<string>,
  input: ModificationsInput | undefined,
): Set<string> => {
  const after = new Set(existing);
  for (const id of input?.remove ?? []) after.delete(id);
  for (const m of input?.upsert ?? []) after.add(m.id);
  return after;
};

/** Чужа модифікація (id існує, але в іншого товару) — не можна ні змінити, ні перехопити. */
export async function assertNotForeign(
  ctx: ChildCtx,
  upserts: readonly Upsert[],
  existing: ReadonlySet<string>,
): Promise<void> {
  const res = await ctx.db.execute<{ id: string }>(
    sql`select id from public.product_modifications
         where id = any(${uuidArray(upserts.map((u) => u.id))})
           and product_id <> ${ctx.productId}`,
  );
  const foreign = new Set(res.rows.map((r) => r.id));
  upserts.forEach((u, i) => {
    if (foreign.has(u.id) && !existing.has(u.id))
      throw fail(['modifications', 'upsert', i, 'id'], 'invalid_value');
  });
}
