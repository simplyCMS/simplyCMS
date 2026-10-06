import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { shippingZonesCollection, useCollection } from 'simplycms/admin-data';
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
import { ShippingZoneRow } from './ShippingZoneRow';
import { useShippingZoneDefault } from './useShippingZoneDefault';

/**
 * Список зон доставки (Е6а, Task 7): жива eager-колекція. Видалення —
 * `collection.delete` → guarded `removeShippingZones` (дефолтну сервер
 * відхиляє 409); дефолт — `setDefaultShippingZone` через
 * `useShippingZoneDefault`. Причина відмови — тостом.
 */
export default function ShippingZonesPage() {
  const t = useT();
  const navigate = useNavigate();
  const collection = useCollection(shippingZonesCollection);
  const applyDefault = useShippingZoneDefault();
  const { data: zones, isLoading } = useLiveQuery({
    query: (q) =>
      q.from({ z: collection }).orderBy(({ z }) => z.sortOrder, 'asc'),
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const toggle = (id: string, isActive: boolean) =>
    collection
      .update(id, (d) => {
        d.isActive = isActive;
      })
      .isPersisted.promise.then(() => toast.success(t('common.statusUpdated')))
      .catch((e: unknown) => reportTxError(t, e));

  const makeDefault = (id: string) =>
    applyDefault(id)
      .then(() => toast.success(t('admin.shipping.zones.defaultSet')))
      .catch((e: unknown) => reportTxError(t, e));

  const handleDelete = (id: string) => {
    setDeleteId(null);
    collection
      .delete(id)
      .isPersisted.promise.then(() =>
        toast.success(t('admin.shipping.zones.deleted')),
      )
      .catch((e: unknown) => reportTxError(t, e));
  };

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.nav.shippingZones')}</h1>
          <p className="text-muted-foreground">
            {t('admin.shipping.zones.subtitle')}
          </p>
        </div>
        <Button
          onClick={() =>
            navigate({
              to: adminPath('shipping/zones/$zoneId'),
              params: { zoneId: 'new' },
            })
          }
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.shipping.zones.add')}
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('admin.shipping.zones.cities')}</TableHead>
                <TableHead className="text-center">
                  {t('common.activeF')}
                </TableHead>
                <TableHead className="text-right">
                  {t('common.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((z) => (
                <ShippingZoneRow
                  key={z.id}
                  zone={z}
                  onToggle={(v) => toggle(z.id, v)}
                  onMakeDefault={() => makeDefault(z.id)}
                  onDelete={() => setDeleteId(z.id)}
                />
              ))}
              {zones.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    {t('admin.shipping.zones.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <DeleteConfirmDialog
        title={t('admin.shipping.zones.deleteTitle')}
        warning={t('admin.shipping.zones.deleteWarning')}
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
      />
    </div>
  );
}
