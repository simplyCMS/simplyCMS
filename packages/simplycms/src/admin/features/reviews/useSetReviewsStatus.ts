import { useQueryClient } from '@tanstack/react-query';
import { setReviewsStatus } from 'simplycms/admin-server';
import { ENTITY } from 'simplycms/contracts/entities';
import type { ReviewStatus } from 'simplycms/contracts/objects';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { adminErrorKey } from '../../lib/admin-error';
import { reportTxError } from '../../lib/report-tx-error';

/** `ok` — записано; `gone` — відгук зник (409): стан застарів; `failed` — решта збоїв. */
export type StatusOutcome = 'ok' | 'gone' | 'failed';

/**
 * Зміна статусу одного чи багатьох відгуків (список і картка). Кеш
 * синхронізується в ЦІЙ функції (К3-7) і після відмови теж: 409 означає, що
 * список застарів — його й лічильник «очікують» треба перечитати (Review
 * Focus 3).
 */
export function useSetReviewsStatus() {
  const t = useT();
  const qc = useQueryClient();
  return async (
    ids: string[],
    status: ReviewStatus,
    adminComment?: string | null,
  ): Promise<StatusOutcome> => {
    let outcome: StatusOutcome = 'ok';
    try {
      const { updated } = await setReviewsStatus({
        data:
          adminComment === undefined
            ? { ids, status }
            : { ids, status, adminComment },
      });
      toast.success(t('admin.reviews.updated', { count: updated }));
    } catch (e) {
      outcome =
        adminErrorKey(e) === 'admin.errors.reviewNotFound' ? 'gone' : 'failed';
      reportTxError(t, e);
    }
    await qc.invalidateQueries({ queryKey: [ENTITY.productReviews] });
    return outcome;
  };
}
