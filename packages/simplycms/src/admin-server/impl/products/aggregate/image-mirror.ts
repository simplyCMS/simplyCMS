import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';

/**
 * М1-TEMP: зноситься в Task 17 — старі читачі вітрини/адмінки беруть фото з
 * jsonb `products.images` / `product_modifications.images`, тож команда
 * перераховує їх із `product_images` (порядок `sort_order`).
 */
export async function mirrorImages(
  db: ActorDb,
  productId: string,
): Promise<void> {
  await db.execute(sql`
    update public.products p set images = coalesce((
      select jsonb_agg(i.storage_key order by i.sort_order, i.created_at, i.id)
        from public.product_images i
       where i.product_id = p.id and i.modification_id is null), '[]'::jsonb)
     where p.id = ${productId}`);
  await db.execute(sql`
    update public.product_modifications m set images = coalesce((
      select jsonb_agg(i.storage_key order by i.sort_order, i.created_at, i.id)
        from public.product_images i where i.modification_id = m.id), '[]'::jsonb)
     where m.product_id = ${productId}`);
}
