import { useNavigate } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import type { UserCategory } from 'simplycms/schema/types';
import { Badge } from 'simplycms/ui/badge';
import { Button } from 'simplycms/ui/button';
import { TableCell, TableRow } from 'simplycms/ui/table';
import { Star, Trash2 } from 'lucide-react';
import { adminPath } from '../../../lib/adminLinks';

interface Props {
  readonly category: UserCategory;
  readonly priceTypeName: string | null;
  readonly customers: number | undefined;
  readonly onMakeDefault: () => void;
  readonly onDelete: () => void;
}

/**
 * Рядок списку категорій. Дефолтна категорія невидалювана (Е6в-18):
 * кнопки видалення в неї немає взагалі, а не лише вимкнена.
 */
export function UserCategoryRow({
  category,
  priceTypeName,
  customers,
  onMakeDefault,
  onDelete,
}: Props) {
  const t = useT();
  const navigate = useNavigate();
  const stop = (fn: () => void) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    fn();
  };
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() =>
        navigate({ to: adminPath(`user-categories/${category.id}`) })
      }
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{category.name}</span>
          {category.isDefault && (
            <Badge variant="secondary">{t('common.byDefault')}</Badge>
          )}
        </div>
        {category.description && (
          <p className="text-sm text-muted-foreground">
            {category.description}
          </p>
        )}
      </TableCell>
      <TableCell>
        <code className="rounded bg-muted px-2 py-1 text-sm">
          {category.code}
        </code>
      </TableCell>
      <TableCell>
        {priceTypeName ? (
          <Badge variant="outline">{priceTypeName}</Badge>
        ) : (
          <span className="text-muted-foreground">
            {t('common.byDefaultShort')}
          </span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline">{customers ?? '…'}</Badge>
      </TableCell>
      <TableCell className="text-right">
        {!category.isDefault && (
          <>
            <Button variant="ghost" size="sm" onClick={stop(onMakeDefault)}>
              <Star className="mr-1 h-4 w-4" />
              {t('admin.customerCategories.categories.makeDefault')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('common.delete')}
              onClick={stop(onDelete)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )}
      </TableCell>
    </TableRow>
  );
}
