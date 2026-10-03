import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { priceTypesCollection, useCollection } from 'simplycms/admin-data';
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
import { Plus, Trash2, Star, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import { PriceTypeDeleteDialog } from './PriceTypeDeleteDialog';

/**
 * Список типів цін (Е4, Task 6): жива eager-колекція, сортування на
 * клієнті. Видалення — `collection.delete` → guarded `removePriceTypes`
 * (дефолтний тип і тип із цінами сервер відхиляє, колекція відкочує рядок,
 * причина — тостом через `reportTxError`).
 */
export default function PriceTypesPage() {
  const t = useT();
  const navigate = useNavigate();
  const collection = useCollection(priceTypesCollection);
  const { data: priceTypes, isLoading } = useLiveQuery({
    query: (q) =>
      q.from({ p: collection }).orderBy(({ p }) => p.sortOrder, 'asc'),
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setDeleteId(null);
    collection
      .delete(id)
      .isPersisted.promise.then(() => toast.success(t('admin.prices.deleted')))
      .catch((e: unknown) => reportTxError(t, e));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.nav.priceTypes')}</h1>
          <p className="text-muted-foreground">{t('admin.prices.subtitle')}</p>
        </div>
        <Button
          onClick={() =>
            navigate({
              to: adminPath('price-types/$priceTypeId'),
              params: { priceTypeId: 'new' },
            })
          }
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.prices.add')}
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('common.code')}</TableHead>
                <TableHead>{t('common.order')}</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceTypes.map((pt) => (
                <TableRow
                  key={pt.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    navigate({ to: adminPath(`price-types/${pt.id}`) })
                  }
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{pt.name}</span>
                      {pt.isDefault && (
                        <Star className="h-4 w-4 text-warning fill-warning" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {pt.code}
                    </code>
                  </TableCell>
                  <TableCell>{pt.sortOrder}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pt.isDefault}
                      title={
                        pt.isDefault
                          ? t('admin.prices.defaultLocked')
                          : undefined
                      }
                      aria-label={t('common.delete')}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(pt.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {priceTypes.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    {t('admin.prices.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <PriceTypeDeleteDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
      />
    </div>
  );
}
