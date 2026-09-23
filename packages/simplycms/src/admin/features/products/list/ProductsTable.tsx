import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { productsCollection, useCollection } from 'simplycms/admin-data';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'simplycms/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminErrorKey } from '../../../lib/admin-error';
import { adminPath } from '../../../lib/adminLinks';
import ProductRow from './ProductRow';
import type { ProductListRow } from './useProductsList';

interface Props {
  readonly rows: readonly ProductListRow[];
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly onLoadMore: () => void;
}

/** Таблиця списку товарів + «Показати ще» + видалення з підтвердженням. */
export default function ProductsTable({
  rows,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: Props) {
  const t = useT();
  const navigate = useNavigate();
  const products = useCollection(productsCollection);
  const [deleteTarget, setDeleteTarget] = useState<ProductListRow | null>(null);

  const openEdit = (productId: string) =>
    navigate({ to: adminPath('products/$productId'), params: { productId } });

  // Review Focus 2: оптимістичне видалення відкочується САМЕ бібліотекою
  // (rollback колекції) при помилці onDelete — тут лишається пояснити чому.
  const handleDelete = (row: ProductListRow) => {
    const tx = products.delete(row.id);
    tx.isPersisted.promise
      .then(() => toast.success(t('admin.products.deleted')))
      .catch((e: unknown) => {
        const key = adminErrorKey(e);
        toast.error(
          key ? t(key) : `${t('common.error')} ${(e as Error).message}`,
        );
      });
    setDeleteTarget(null);
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16"></TableHead>
            <TableHead>{t('common.name')}</TableHead>
            <TableHead>{t('admin.banners.placement.section')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              onOpen={openEdit}
              onDeleteRequest={setDeleteTarget}
            />
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground"
              >
                {t('admin.products.empty')}
              </TableCell>
            </TableRow>
          )}
          {hasNextPage && (
            <TableRow>
              <TableCell colSpan={5} className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isFetchingNextPage}
                  onClick={onLoadMore}
                >
                  {isFetchingNextPage && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {t('admin.products.loadMore')}
                </Button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.products.confirmDelete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
