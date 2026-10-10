import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { deleteReview } from 'simplycms/admin-server';
import { ENTITY } from 'simplycms/contracts/entities';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';

/** Видалення відгуку з фото (сервер двофазно стирає файли); далі — на список. */
export function useDeleteReview(id: string) {
  const t = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async (): Promise<void> => {
    try {
      await deleteReview({ data: { id } });
    } catch (e) {
      reportTxError(t, e);
      await qc.invalidateQueries({ queryKey: [ENTITY.productReviews] });
      return;
    }
    toast.success(t('admin.reviews.deleted'));
    // Помилка навігації не скасовує видалення, що вже відбулось.
    navigate({ to: adminPath('reviews') }).catch(() => {});
    await qc.invalidateQueries({ queryKey: [ENTITY.productReviews] });
  };
}
