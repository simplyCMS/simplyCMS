import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { bannersCollection, useCollection } from 'simplycms/admin-data';
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
import { adminPath } from '../../lib/adminLinks';
import { reportTxError } from '../../lib/report-tx-error';
import { DeleteConfirmDialog } from '../catalog-dictionaries/DeleteConfirmDialog';
import { PageSpinner } from '../catalog-dictionaries/PageStates';
import { BannerRow } from './BannerRow';

/**
 * Список банерів: жива eager-колекція за `sortOrder`. Перемикач шле лише
 * `{ isActive }` — банер із видаленим розділом вимикається без правки решти
 * (Е6д-12). Видалення — лише після підтвердження.
 */
export default function BannersPage() {
  const t = useT();
  const navigate = useNavigate();
  const collection = useCollection(bannersCollection);
  const { data: banners, isLoading } = useLiveQuery({
    query: (q) =>
      q.from({ b: collection }).orderBy(({ b }) => b.sortOrder, 'asc'),
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
      .isPersisted.promise.then(() => toast.success(t('admin.banners.deleted')))
      .catch((e: unknown) => reportTxError(t, e));
  };

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.nav.banners')}</h1>
          <p className="text-muted-foreground">
            {t('admin.banners.subtitleList')}
          </p>
        </div>
        <Button
          onClick={() =>
            navigate({
              to: adminPath('banners/$bannerId'),
              params: { bannerId: 'new' },
            })
          }
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.banners.add')}
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14"></TableHead>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('admin.banners.placement')}</TableHead>
                <TableHead>{t('admin.banners.schedule')}</TableHead>
                <TableHead className="text-center">
                  {t('common.activeM')}
                </TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banners.map((b) => (
                <BannerRow
                  key={b.id}
                  banner={b}
                  onToggle={(v) => toggle(b.id, v)}
                  onDelete={() => setDeleteId(b.id)}
                />
              ))}
              {banners.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    {t('admin.banners.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <DeleteConfirmDialog
        title={t('admin.banners.deleteTitle')}
        warning={t('admin.banners.deleteWarning')}
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
      />
    </div>
  );
}
