import { useState } from 'react';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { toast } from 'sonner';
import {
  priceTypesCollection,
  productPricesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useFormatPrice } from 'simplycms/react-query';
import { useT } from 'simplycms/i18n';
import type { ProductModification } from 'simplycms/schema/types';
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
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import { adminErrorKey } from '../../../lib/admin-error';
import { useModifications } from './useModifications';
import { ModificationRow } from './ModificationRow';

interface Props {
  readonly productId: string;
  readonly data: ReturnType<typeof useModifications>;
  readonly onEdit: (mod: ProductModification) => void;
}

/** Таблиця модифікацій (Task 8, Step 3) — розмітка легасі `ProductModifications.tsx:530-661`. */
export function ModificationsTable({ productId, data, onEdit }: Props) {
  const t = useT();
  const formatPrice = useFormatPrice();
  const { modifications, reorder, remove } = data;
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Дефолтна ціна рядка — ОДНИМ запитом на всю таблицю (eq productId), не N.
  const prices = useCollection(productPricesCollection);
  const types = useCollection(priceTypesCollection);
  const { data: priceRows } = useLiveQuery(
    (q) => q.from({ p: prices }).where(({ p }) => eq(p.productId, productId)),
    [productId],
  );
  const { data: typeRows } = useLiveQuery((q) => q.from({ t: types }));
  const defaultTypeId = typeRows.find((tp) => tp.isDefault)?.id;
  const priceOf = (modId: string) =>
    priceRows.find(
      (p) => p.modificationId === modId && p.priceTypeId === defaultTypeId,
    );

  const mods = modifications ?? [];

  // Review Focus 2: оптимістичне видалення відкочується САМЕ бібліотекою
  // (rollback колекції) при 23503 — товар/модифікація в замовленнях.
  const handleDelete = (id: string) => {
    setDeleteId(null);
    remove(id)
      .isPersisted.promise.then(() =>
        toast.success(t('admin.products.mods.deleted')),
      )
      .catch((e: unknown) => {
        const key = adminErrorKey(e);
        toast.error(
          key ? t(key) : `${t('common.error')} ${(e as Error).message}`,
        );
      });
  };

  if (mods.length === 0)
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        {t('admin.products.mods.empty')}
      </p>
    );

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">{t('common.order')}</TableHead>
            <TableHead className="w-12"></TableHead>
            <TableHead>{t('common.name')}</TableHead>
            <TableHead>{t('admin.products.mods.skuShort')}</TableHead>
            <TableHead>{t('common.price')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mods.map((mod, index) => (
            <ModificationRow
              key={mod.id}
              mod={mod}
              price={priceOf(mod.id)}
              formatPrice={formatPrice}
              canMoveUp={index > 0}
              canMoveDown={index < mods.length - 1}
              onEdit={() => onEdit(mod)}
              onReorder={(direction) => reorder(mod.id, direction)}
              onDeleteRequest={() => setDeleteId(mod.id)}
            />
          ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.products.mods.confirmDelete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
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
