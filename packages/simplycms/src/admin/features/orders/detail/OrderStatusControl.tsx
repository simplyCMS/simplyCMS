import { useRef, useState } from 'react';
import { orderStatusesCollection, useCollection } from 'simplycms/admin-data';
import { useLiveQuery } from '@tanstack/react-db';
import { ORDER_STATUS_CODE } from 'simplycms/contracts/order-status-codes';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'simplycms/ui/alert-dialog';
import { useChangeOrderStatus } from './useChangeOrderStatus';

interface Props {
  readonly orderId: string;
  readonly statusId: string | null;
}

/**
 * Зміна статусу. «Скасоване» — кінцевий (Е5-2): поточне скасоване → контрол
 * вимкнений; вибір «Скасоване» йде через підтвердження, виклик — лише після
 * нього. Нативний `<select>`: значення береться з колекції, тож після
 * write-back контрол сам показує новий статус.
 */
export function OrderStatusControl({ orderId, statusId }: Props) {
  const t = useT();
  const change = useChangeOrderStatus();
  const col = useCollection(orderStatusesCollection);
  const { data: statuses } = useLiveQuery({
    query: (q) => q.from({ s: col }).orderBy(({ s }) => s.sortOrder, 'asc'),
  });
  const [pending, setPending] = useState<string | null>(null);
  const cancelledId = statuses.find(
    (s) => s.code === ORDER_STATUS_CODE.cancelled,
  )?.id;
  const locked = statusId !== null && statusId === cancelledId;

  // Поки зміна летить, другий запит (повторне підтвердження чи інший вибір)
  // не шлеться: ref, а не стан — перевірка синхронна, без чекання рендера.
  const inFlight = useRef(false);
  const submit = async (id: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await change(orderId, id);
    } finally {
      inFlight.current = false;
    }
  };

  const onPick = (id: string) => {
    if (id === statusId) return;
    if (id === cancelledId) setPending(id);
    else void submit(id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.orders.statusSection')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <select
          aria-label={t('admin.orders.statusSection')}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
          value={statusId ?? ''}
          disabled={locked}
          onChange={(e) => onPick(e.target.value)}
        >
          {statusId === null && (
            <option value="" disabled>
              {t('admin.orders.pickStatus')}
            </option>
          )}
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {locked && (
          <p className="text-sm text-muted-foreground">
            {t('admin.orders.cancelledFinal')}
          </p>
        )}
      </CardContent>
      <AlertDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.orders.cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.orders.cancelWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) void submit(pending);
                setPending(null);
              }}
            >
              {t('admin.orders.cancelConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
