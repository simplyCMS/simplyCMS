import { useState } from 'react';
import { toast } from 'sonner';
import { setDefaultOrderStatus } from 'simplycms/admin-server';
import { useT } from 'simplycms/i18n';

type OkKey = 'admin.orders.statuses.created' | 'common.statusUpdated';
type FailKey =
  'admin.orders.statuses.createFailed' | 'admin.orders.statuses.updateFailed';

/**
 * Персист оптимістичної мутації статусу у дві фази: insert/update, потім —
 * за потреби — `setDefault` (міняє N рядків, тож завершується `refetch()`).
 * Діалог закривається ЛИШЕ після успішного персисту (рев'ю р3); падіння
 * дефолту — окрема помилка, а не «створення не вдалося» (рядок уже є).
 */
export function useStatusPersist(
  collection: { utils: { refetch: () => Promise<unknown> } },
  close: () => void,
) {
  const t = useT();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const applyDefault = async (id: string) => {
    await setDefaultOrderStatus({ data: { id } });
    await collection.utils.refetch();
  };

  const afterPersist = async (id: string, isDefault: boolean) => {
    close();
    if (!isDefault) return;
    try {
      await applyDefault(id);
    } catch (e) {
      toast.error(
        t('admin.orders.statuses.updateFailed') + ' ' + (e as Error).message,
      );
    }
  };

  const persist = (
    tx: { isPersisted: { promise: Promise<unknown> } },
    id: string,
    isDefault: boolean,
    okKey: OkKey,
    failKey: FailKey,
  ) => {
    setIsSubmitting(true);
    tx.isPersisted.promise
      .then(async () => {
        toast.success(t(okKey));
        await afterPersist(id, isDefault);
      })
      .catch((e: Error) => toast.error(t(failKey) + ' ' + e.message))
      .finally(() => setIsSubmitting(false));
  };

  return { isSubmitting, persist };
}
