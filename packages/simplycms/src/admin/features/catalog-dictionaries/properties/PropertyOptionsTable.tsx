import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { propertyOptionsCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import { DeleteConfirmDialog } from '../DeleteConfirmDialog';
import { MediaThumb } from '../MediaThumb';
import { BlockSpinner } from '../PageStates';

interface Props {
  readonly propertyId: string;
}

/**
 * Опції властивості (Е4, Task 8): зріз on-demand колекції `where
 * propertyId` (як картка товару Е3), `orderBy sortOrder`. Видалення —
 * через підтвердження; значення опції в товарах стають NULL (ON DELETE
 * SET NULL). Відмова сервера → тост, бібліотека відкочує рядок сама.
 */
export function PropertyOptionsTable({ propertyId }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const collection = useCollection(propertyOptionsCollection);
  const { data: options, isLoading } = useLiveQuery(
    (q) =>
      q
        .from({ o: collection })
        .where(({ o }) => eq(o.propertyId, propertyId))
        .orderBy(({ o }) => o.sortOrder, 'asc'),
    [propertyId],
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setDeleteId(null);
    collection
      .delete(id)
      .isPersisted.promise.then(() =>
        toast.success(t('admin.properties.options.deleted')),
      )
      .catch((e: unknown) => reportTxError(t, e));
  };

  if (isLoading) return <BlockSpinner />;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14"></TableHead>
            <TableHead>{t('common.name')}</TableHead>
            <TableHead>{t('admin.common.slug')}</TableHead>
            <TableHead>{t('admin.properties.options.page')}</TableHead>
            <TableHead className="text-right w-16">
              {t('common.actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {options.map((option) => (
            <TableRow
              key={option.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() =>
                navigate({
                  to: adminPath(
                    `properties/${propertyId}/options/${option.id}`,
                  ),
                })
              }
            >
              <TableCell>
                <MediaThumb
                  reference={option.imageUrl}
                  alt={option.name}
                  size={32}
                />
              </TableCell>
              <TableCell className="font-medium">{option.name}</TableCell>
              <TableCell className="text-muted-foreground font-mono text-sm">
                {option.slug}
              </TableCell>
              <TableCell>
                {option.description || option.imageUrl ? (
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                    {t('admin.properties.options.filled')}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('admin.properties.options.delete')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(option.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {options.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground"
              >
                {t('admin.properties.options.empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title={t('admin.properties.options.deleteTitle')}
        warning={t('admin.properties.options.deleteWarning')}
      />
    </>
  );
}
