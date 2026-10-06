import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { shippingMethodsCollection, useCollection } from 'simplycms/admin-data';
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
import { ShippingMethodRow } from './ShippingMethodRow';

/**
 * Список способів доставки (Е6а, Task 6): жива eager-колекція.
 * Видалення — `collection.delete` → guarded `removeShippingMethods`
 * (спосіб із точками самовивозу сервер відхиляє 409, причина — тостом).
 */
export default function ShippingMethodsPage() {
  const t = useT();
  const navigate = useNavigate();
  const collection = useCollection(shippingMethodsCollection);
  const { data: methods, isLoading } = useLiveQuery({
    query: (q) =>
      q.from({ m: collection }).orderBy(({ m }) => m.sortOrder, 'asc'),
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
        toast.success(t('admin.shipping.methods.deleted')),
      )
      .catch((e: unknown) => reportTxError(t, e));
  };

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {t('admin.nav.shippingMethods')}
          </h1>
          <p className="text-muted-foreground">
            {t('admin.shipping.methods.subtitle')}
          </p>
        </div>
        <Button
          onClick={() =>
            navigate({
              to: adminPath('shipping/methods/$methodId'),
              params: { methodId: 'new' },
            })
          }
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.shipping.methods.add')}
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('admin.shipping.methods.provider')}</TableHead>
                <TableHead>{t('admin.shipping.methods.pricing')}</TableHead>
                <TableHead className="text-center">
                  {t('common.activeF')}
                </TableHead>
                <TableHead>{t('common.order')}</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((m) => (
                <ShippingMethodRow
                  key={m.id}
                  method={m}
                  onToggle={(v) => toggle(m.id, v)}
                  onDelete={() => setDeleteId(m.id)}
                />
              ))}
              {methods.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    {t('admin.shipping.methods.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <DeleteConfirmDialog
        title={t('admin.shipping.methods.deleteTitle')}
        warning={t('admin.shipping.methods.deleteWarning')}
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
      />
    </div>
  );
}
