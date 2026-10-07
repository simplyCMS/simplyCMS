import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateDiscountConsumers } from 'simplycms/admin-data';
import { runCategoryRules } from 'simplycms/admin-server';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { reportTxError } from '../../../lib/report-tx-error';
import { invalidateCustomerCounts } from '../categories/useCategoryCustomerCounts';

/**
 * «Запустити всі правила» (Е6в-19, Е6в-25). Збій окремих покупців не валить
 * запуск: сервер повертає `failed`, і він показується ОКРЕМИМ тостом — щоб
 * «змінено: 3» не читалось як «усе гаразд», коли двох не оброблено.
 */
export function useRunCategoryRules() {
  const t = useT();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      // Запуск міняє профілі, а не рядки колекцій; кеш скидається нижче.
      // cache-sync-ok: лічильники й ціни — invalidateCustomerCounts/Consumers
      const { checked, changed, failed } = await runCategoryRules();
      toast.success(
        t('admin.customerCategories.rules.runResult', { checked, changed }),
      );
      if (failed > 0)
        toast.error(t('admin.customerCategories.rules.runFailed', { failed }));
      // Категорії покупців змінились: лічильники й ціни вітрини застаріли.
      await Promise.all([
        invalidateCustomerCounts(queryClient),
        invalidateDiscountConsumers(queryClient),
      ]);
    } catch (e) {
      reportTxError(t, e);
    } finally {
      setRunning(false);
    }
  };
  return { run, running };
}
