import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import {
  sectionPropertiesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
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
import { DeleteConfirmDialog } from '../DeleteConfirmDialog';
import { PageSpinner } from '../PageStates';
import { PropertyCreateDialog } from './PropertyCreateDialog';
import { PropertyRow } from './PropertyRow';

/**
 * Список властивостей (Е4, Task 8). On-demand колекція БЕЗ `where` —
 * повний зріз, `orderBy name` (Е4-9; контракт —
 * `admin-data/__tests__/on-demand-full-slice.test.tsx`, живий підпис).
 */
export default function PropertiesPage() {
  const t = useT();
  const navigate = useNavigate();
  const collection = useCollection(sectionPropertiesCollection);
  const { data: properties, isLoading } = useLiveQuery({
    query: (q) => q.from({ p: collection }).orderBy(({ p }) => p.name, 'asc'),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setDeleteId(null);
    collection
      .delete(id)
      .isPersisted.promise.then(() =>
        toast.success(t('admin.properties.deleted')),
      )
      .catch((e: unknown) => reportTxError(t, e));
  };

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.nav.properties')}</h1>
          <p className="text-muted-foreground">
            {t('admin.properties.subtitle')}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.properties.add')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.properties.all')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('admin.common.slug')}</TableHead>
                <TableHead>{t('common.type')}</TableHead>
                <TableHead>{t('common.filter')}</TableHead>
                <TableHead className="text-right">
                  {t('common.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property) => (
                <PropertyRow
                  key={property.id}
                  property={property}
                  onOpen={() =>
                    navigate({ to: adminPath(`properties/${property.id}`) })
                  }
                  onDelete={() => setDeleteId(property.id)}
                />
              ))}
              {properties.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    {t('admin.properties.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <PropertyCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title={t('admin.properties.deleteTitle')}
        warning={t('admin.properties.deleteWarning')}
      />
    </div>
  );
}
