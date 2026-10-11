import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AdminReviewCard } from 'simplycms/contracts';
import { normalizeMediaRefs } from 'simplycms/domain/media';
import { sanitizeNullableRichHtml } from 'simplycms/sanitize';
import { runAdmin } from '../run';
import { isoTs, isoVersion, toDate } from '../sql-timestamps';
import { parseAdminInput } from '../validation';

export const getReviewCardInput = z.object({ id: z.uuid() });

type Raw = Omit<
  AdminReviewCard,
  'content' | 'images' | 'createdAt' | 'updatedAt'
> & {
  content: string | null;
  images: unknown;
  createdAt: string;
  updatedAt: string;
};

/**
 * Картка відгуку (`review.moderate`) або `null`. Поглинає колишній
 * легасі-запит вмісту відгуку (Е6д-11): `content` очищено на сервері (відгук —
 * недовірений вхід, а виконався б у сесії власника), `images` — референси, які
 * адмінка резолвить клієнтським `resolveMediaUrl`. `images` нормалізовано:
 * колонка nullable `jsonb` без CHECK форми.
 */
export const getReviewCardOp = async ({
  data,
}: {
  data: z.input<typeof getReviewCardInput>;
}): Promise<AdminReviewCard | null> => {
  const { id } = parseAdminInput(getReviewCardInput, data);
  return runAdmin('review.moderate', async (db) => {
    const result = await db.execute<Raw>(sql`
      select r.id, r.product_id as "productId", p.name as "productName",
             p.slug as "productSlug", s.slug as "sectionSlug",
             r.user_id as "userId",
             coalesce(nullif(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''),
                      u.name) as "authorName",
             u.email as "authorEmail", r.rating, r.title, r.status,
             r.content, r.admin_comment as "adminComment", r.images,
             case when jsonb_typeof(r.images) = 'array'
                  then jsonb_array_length(r.images) else 0 end as "imagesCount",
             ${isoTs(sql`r.created_at`)} as "createdAt",
             ${isoVersion(sql`r.updated_at`)} as "updatedAt"
        from public.product_reviews r
        join public.products p on p.id = r.product_id
        left join public.sections s on s.id = p.section_id
        left join public.users u on u.id = r.user_id
        left join public.profiles pr on pr.user_id = u.id
       where r.id = ${id}`);
    const row = result.rows[0];
    if (!row) return null;
    return {
      ...row,
      content: sanitizeNullableRichHtml(row.content, 'review'),
      images: normalizeMediaRefs(row.images),
      createdAt: toDate(row.createdAt),
      updatedAt: toDate(row.updatedAt),
    };
  });
};
