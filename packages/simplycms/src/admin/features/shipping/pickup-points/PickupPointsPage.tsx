import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import {
  pickupPointsCollection,
  shippingZonesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent } from 'simplycms/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import { DeleteConfirmDialog } from '../../catalog-dictionaries/DeleteConfirmDialog';
import { PageSpinner } from '../../catalog-dictionaries/PageStates';
import { PickupPointRow } from './PickupPointRow';

/**
 * Список точок видачі (Е6а, Task 7): жива eager-колекція. Видалення —
 * `collection.delete` → guarded `removePickupPoints` (системну точку й точку
 * із залишком сервер відхиляє 409, причина — тостом).
 */
export default function PickupPointsPage() {
  const t = useT();
  const navigate = useNavigate();
  const collection = useCollection(pickupPointsCollection);
  const zonesCollection = useCollection(shippingZonesCollection);
  const { data: points, isLoading } = useLiveQuery({
    query: (q) =>
      q.from({ p: collection }).orderBy(({ p }) => p.sortOrder, 'asc'),
  });
  const { data: zones } = useLiveQuery({
    query: (q) => q.from({ z: zonesCollection }),
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const toggle = (id: string, isActive: boolean) =>
    collection
      .update(id, (d) => {
        d.isActive = isActive;
      })
      .isPersisted.promise.then(() => toast.success(t('common.statusUpdated')))
      .catch((e: unknown) => reportTxError(t, e));

  const handleDelete = (id: string) => {
    setDeleteId(null);
    collection
      .delete(id)
      .isPersisted.promise.then(() =>
        toast.success(t('admin.shipping.points.deleted')),
      )
      .catch((e: unknown) => reportTxError(t, e));
  };

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.nav.pickupPoints')}</h1>
          <p className="text-muted-foreground">
            {t('admin.shipping.points.subtitle')}
          </p>
        </div>
        <Button
          onClick={() =>
            navigate({
              to: adminPath('shipping/pickup-points/$pointId'),
              params: { pointId: 'new' },
            })
          }
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.shipping.points.add')}
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('common.city')}</TableHead>
                <TableHead>{t('common.address')}</TableHead>
                <TableHead>{t('admin.shipping.points.zone')}</TableHead>
                <TableHead className="text-center">
                  {t('common.activeF')}
                </TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((p) => (
                <PickupPointRow
                  key={p.id}
                  point={p}
                  zoneName={zones.find((z) => z.id === p.zoneId)?.name}
                  onToggle={(v) => toggle(p.id, v)}
                  onDelete={() => setDeleteId(p.id)}
                />
              ))}
              {points.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    {t('admin.shipping.points.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <DeleteConfirmDialog
        title={t('admin.shipping.points.deleteTitle')}
        warning={t('admin.shipping.points.deleteWarning')}
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
      />
    </div>
  );
}
