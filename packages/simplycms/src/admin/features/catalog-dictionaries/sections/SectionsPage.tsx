import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { sectionsCollection, useCollection } from 'simplycms/admin-data';
import { resolveMediaUrl } from 'simplycms/domain/media';
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
import { Plus, Trash2, Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import { SectionDeleteDialog } from './SectionDeleteDialog';

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
              {sections.map((section) => {
                // 🔴 imageUrl — референс сховища, а не URL (Е2-1).
                const thumb = resolveMediaUrl(section.imageUrl);
                return (
                  <TableRow
                    key={section.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      navigate({ to: adminPath(`sections/${section.id}`) })
                    }
                  >
                    <TableCell>
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={section.name}
                          width={40}
                          height={40}
                          className="object-cover rounded"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                          <ImageIcon
                            className="h-4 w-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {section.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {section.slug}
                    </TableCell>
                    <TableCell>{section.sortOrder}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          section.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {section.isActive
                          ? t('common.activeM')
                          : t('admin.sections.inactive')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('common.delete')}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(section.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
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
      <SectionDeleteDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
      />
    </div>
  );
}
