import { useState } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { failureText } from '../../lib/report-tx-error';
import {
  invalidateCollection,
  useCollection,
  orderStatusesCollection,
} from 'simplycms/admin-data';
import { removeOrderStatus, reorderOrderStatus } from 'simplycms/admin-server';
import type { OrderStatus } from 'simplycms/schema/types';
import { useT } from 'simplycms/i18n';

/**
 * Стан і дії сторінки статусів замовлень. Читання — жива eager-колекція (лише читання);
 * запис — команди агрегата `order-statuses.*` зі `version` рядка. 🔴 Після будь-якої дії
 * (успіх чи збій, зокрема 412/409) сторінка САМА інвалідує колекцію, а не повторює запит із
 * версією з помилки: `reorder` дає 412 і коли змінився сусід (версія цілі та сама), а
 * `setDefault` — 409 `concurrent_change`. Інвалідація, не `utils.refetch()`: список під
 * відкритим діалогом без спостерігача refetch не бачить (див. `useProductCardState`).
 */
export function useOrderStatusesPage() {
  const t = useT();
  const collection = useCollection(orderStatusesCollection);
  const queryClient = useQueryClient();
  // 🔴 Форма react-db 0.5.3 — обʼєкт { query }; dependency-масиви задепрековані.
  const { data: statuses, isLoading } = useLiveQuery({
    query: (q) =>
      q.from({ s: collection }).orderBy(({ s }) => s.sortOrder, 'asc'),
  });
  const [dialog, setDialog] = useState<
    { editing: OrderStatus | null } | undefined
  >();
  const [deleting, setDeleting] = useState<OrderStatus | null>(null);

  const refresh = () =>
    invalidateCollection(queryClient, orderStatusesCollection);

  /** Дія над рядком: після неї — завжди перечитування; помилка — локалізований тост. */
  const act = async (
    run: () => Promise<unknown>,
    failKey: Parameters<typeof t>[0],
  ) => {
    try {
      await run();
    } catch (e) {
      toast.error(failureText(t, t(failKey), e));
    }
    await refresh().catch(() => undefined);
  };

  const remove = async (s: OrderStatus) => {
    setDeleting(null);
    await act(async () => {
      // cache-sync-ok: колекцію інвалідує `act` після будь-якого виходу
      await removeOrderStatus({
        data: { id: s.id, expectedVersion: s.version },
      });
      toast.success(t('admin.orders.statuses.deleted'));
    }, 'admin.orders.statuses.deleteFailed');
  };

  const reorder = (s: OrderStatus, direction: 'up' | 'down') =>
    act(async () => {
      // cache-sync-ok: колекцію інвалідує `act` після будь-якого виходу
      await reorderOrderStatus({
        data: { id: s.id, direction, expectedVersion: s.version },
      });
    }, 'admin.orders.statuses.reorderFailed');

  return {
    statuses,
    isLoading,
    dialog,
    deleting,
    setDeleting,
    openCreate: () => setDialog({ editing: null }),
    openEdit: (s: OrderStatus) => setDialog({ editing: s }),
    closeDialog: () => setDialog(undefined),
    refresh,
    nextSortOrder:
      statuses.reduce((max, s) => Math.max(max, s.sortOrder), -1) + 1,
    remove,
    reorder,
  };
}
