import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ordersCollection, useCollection } from 'simplycms/admin-data';
import { deleteCustomer } from 'simplycms/admin-server';
import { ENTITY } from 'simplycms/contracts/entities';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { applyServerValidation } from '../../../lib/apply-server-validation';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';

export interface DeleteResult {
  readonly ok: boolean;
  /** Помилка поля підтвердження (ValidationError), якщо сервер її дав. */
  readonly fieldError?: string;
}

/**
 * Видалення акаунта (Е6г-15). Знеособлення зачіпає замовлення, а вони в
 * колекції on-demand — тож окрім `[profiles]` кличемо `refetch` колекції
 * (Е6г-6). Після успіху — на список; відмови 409 — тост, діалог лишається.
 */
export function useDeleteCustomer(userId: string) {
  const t = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const orders = useCollection(ordersCollection);
  return async (confirmEmail: string): Promise<DeleteResult> => {
    try {
      await deleteCustomer({ data: { userId, confirmEmail } });
      await qc.invalidateQueries({ queryKey: [ENTITY.profiles] });
      await orders.utils.refetch();
      toast.success(t('admin.users.card.deleted'));
      await navigate({ to: adminPath('users') });
      return { ok: true };
    } catch (e) {
      let fieldError: string | undefined;
      const unmapped = applyServerValidation(
        e,
        (_field, err) => {
          fieldError = err.message;
        },
        {
          t,
          fieldFor: (path) =>
            path[0] === 'confirmEmail' ? 'confirmEmail' : null,
        },
      );
      if (unmapped === null || unmapped.length > 0) reportTxError(t, e);
      return { ok: false, fieldError };
    }
  };
}
