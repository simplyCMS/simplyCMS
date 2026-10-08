import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
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
 * Видалення акаунта (Е6г-15). Знеособлення зачіпає замовлення, тож окрім
 * `[profiles]` інвалідуємо префікс `[orders]` (Е6г-6): ключ колекції
 * `[orders,'list']` під ним, тому ЄДИНИЙ механізм будить і колекцію
 * замовлень, і дашборд (`[orders,'admin-dashboard']`). Окремого `refetch`
 * колекції немає — файл не імпортує `simplycms/admin-data`. Після успіху —
 * на список; відмови 409 — тост, діалог лишається.
 */
export function useDeleteCustomer(userId: string) {
  const t = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async (confirmEmail: string): Promise<DeleteResult> => {
    try {
      await deleteCustomer({ data: { userId, confirmEmail } });
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
    // Видалення вже відбулось: збій кроків нижче не є «видалення не вдалось».
    // Спершу перехід, щоб відкрита картка не блимнула «не знайдено» після
    // інвалідації; кеш синхронізуємо у фоні.
    toast.success(t('admin.users.card.deleted'));
    // Помилка навігації не відкочує видалення й не має стати необробленим
    // відхиленням промісу: акаунт уже стертий, картка лишається як є.
    navigate({ to: adminPath('users') }).catch(() => {});
    await Promise.allSettled([
      qc.invalidateQueries({ queryKey: [ENTITY.profiles] }),
      // Дашборд (`[orders, 'admin-dashboard']`) показує імʼя клієнта в
      // останніх замовленнях — знеособлене не має лишитись у кеші.
      qc.invalidateQueries({ queryKey: [ENTITY.orders] }),
    ]);
    return { ok: true };
  };
}
