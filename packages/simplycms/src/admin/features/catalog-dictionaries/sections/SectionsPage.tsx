import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { sectionsCollection, useCollection } from 'simplycms/admin-data';
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
import { SectionRow } from './SectionRow';

/**
 * Список розділів (Е4, Task 7): жива eager-колекція, сортування за
 * `sortOrder`, потім за назвою. Видалення — `collection.delete` через
 * підтвердження `AlertDialog`; товари розділу лишаються з `section_id NULL`.
 */
export default function SectionsPage() {
  const t = useT();
  const navigate = useNavigate();
  const collection = useCollection(sectionsCollection);
  const { data: sections, isLoading } = useLiveQuery({
    query: (q) =>
      q
        .from({ s: collection })
        .orderBy(({ s }) => s.sortOrder, 'asc')
        .orderBy(({ s }) => s.name, 'asc'),
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setDeleteId(null);
    collection
      .delete(id)
      .isPersisted.promise.then(() =>
        toast.success(t('admin.sections.deleted')),
      )
      .catch((e: unknown) => reportTxError(t, e));
  };

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.nav.sections')}</h1>
          <p className="text-muted-foreground">
            {t('admin.sections.subtitle')}
          </p>
        </div>
        <Button
          onClick={() =>
            navigate({
              to: adminPath('sections/$sectionId'),
              params: { sectionId: 'new' },
            })
          }
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.sections.add')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.sections.all')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('admin.common.slug')}</TableHead>
                <TableHead>{t('common.order')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead className="text-right">
                  {t('common.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.map((section) => (
                <SectionRow
                  key={section.id}
                  section={section}
                  onOpen={() =>
                    navigate({ to: adminPath(`sections/${section.id}`) })
                  }
                  onDelete={() => setDeleteId(section.id)}
                />
              ))}
              {sections.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    {t('admin.sections.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <DeleteConfirmDialog
        title={t('admin.sections.deleteTitle')}
        warning={t('admin.sections.deleteWarning')}
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
      />
    </div>
  );
}
