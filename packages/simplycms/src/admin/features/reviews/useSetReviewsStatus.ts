import { useQueryClient } from '@tanstack/react-query';
import { setReviewsStatus } from 'simplycms/admin-server';
import { ENTITY } from 'simplycms/contracts/entities';
import type { ReviewStatus } from 'simplycms/contracts/objects';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { adminErrorKey } from '../../lib/admin-error';
import { reportTxError } from '../../lib/report-tx-error';

/** Версія відгуку, яку побачив модератор (Е6д-23). */
export interface ReviewVersion {
  readonly id: string;
  readonly updatedAt: Date;
}

/**
 * `ok` — записано; `gone` — відгук зник, `changed` — покупець змінив його
 * після того, як модератор його побачив (обидва 409: стан застарів); `failed`
 * — решта збоїв.
 */
export type StatusOutcome = 'ok' | 'gone' | 'changed' | 'failed';

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
    items: readonly ReviewVersion[],
    status: ReviewStatus,
    adminComment?: string | null,
  ): Promise<StatusOutcome> => {
    let outcome: StatusOutcome = 'ok';
    try {
      // ISO з мілісекундами: саме з нею сервер звіряє версію під локом.
      const wire = items.map((i) => ({
        id: i.id,
        updatedAt: i.updatedAt.toISOString(),
      }));
      const { updated } = await setReviewsStatus({
        data:
          adminComment === undefined
            ? { items: wire, status }
            : { items: wire, status, adminComment },
      });
      toast.success(t('admin.reviews.updated', { count: updated }));
    } catch (e) {
      const key = adminErrorKey(e);
      outcome =
        key === 'admin.errors.reviewNotFound'
          ? 'gone'
          : key === 'admin.reviews.changed'
            ? 'changed'
            : 'failed';
      reportTxError(t, e);
    }
    await qc.invalidateQueries({ queryKey: [ENTITY.productReviews] });
    return outcome;
  };
}
