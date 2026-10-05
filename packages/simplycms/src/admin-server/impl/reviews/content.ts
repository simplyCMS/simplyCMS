import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { SanitizedHtml } from 'simplycms/contracts';
import { sanitizeNullableRichHtml } from 'simplycms/sanitize';
import { productReviews } from 'simplycms/schema';
import { runAdmin } from '../run';

export const reviewContentInput = z.object({ reviewId: z.uuid() });

/**
 * Розмітка відгуку для сторінки модерації — ОЧИЩЕНА на сервері (Тема 9,
 * рубіж 2).
 *
 * 🔴 Сторінка модерації (`admin/pages/ReviewDetail.tsx`) читає рядок відгуку
 * легасі-шляхом `supabase-js` із браузера — там санітизатору (server-only)
 * взятися ніде. Тому розмітку для показу сторінка бере ЗВІДСИ, а не з рядка:
 * відгук покупця — недовірений вхід, і саме у власника магазину він виконався б
 * в адмінці (перехоплення сесії). Операція `review.moderate` — той самий грант,
 * що й на модерацію.
 */
export const getReviewContentOp = async ({
  data,
}: {
  data: z.infer<typeof reviewContentInput>;
}): Promise<{ content: SanitizedHtml | null }> =>
  runAdmin('review.moderate', async (db) => {
    const [row] = await db
      .select({ content: productReviews.content })
      .from(productReviews)
      .where(eq(productReviews.id, data.reviewId))
      .limit(1);
    return { content: sanitizeNullableRichHtml(row?.content, 'review') };
  });
