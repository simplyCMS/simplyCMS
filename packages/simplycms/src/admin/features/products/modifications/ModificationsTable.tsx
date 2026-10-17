import { useState } from 'react';
import { eq, useLiveQuery } from '@tanstack/react-db';
import {
  priceTypesCollection,
  productPricesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useFormatPrice } from 'simplycms/react-query';
import { useT } from 'simplycms/i18n';
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
import { useFormContext, useWatch } from 'react-hook-form';
import { useProductCard } from '../edit/product-card-context';
import type {
  DraftModification,
  ProductFormValues,
} from '../edit/product-form-schema';
import { imageKeys } from '../edit/product-images';
import { useTranslationContext } from '../../translations/translation-context';
import { useModifications } from './useModifications';
import { ModificationRow } from './ModificationRow';

interface Props {
  readonly productId: string;
  readonly data: ReturnType<typeof useModifications>;
  readonly onEdit: (mod: DraftModification) => void;
}

/**
 * Таблиця модифікацій чернетки картки. Назва, SKU, дефолт і фото — з
 * чернетки; ціна й статус наявності — з колекцій лише для читання (для ще не
 * збереженої модифікації їх немає).
 */
export function ModificationsTable({ productId, data, onEdit }: Props) {
  const t = useT();
  const formatPrice = useFormatPrice();
  const { modifications: mods, reorder, remove } = data;
  const { primary, active } = useTranslationContext();
  const card = useProductCard();
  const { control } = useFormContext<ProductFormValues>();
  const images = useWatch({ control, name: 'images' });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Дефолтна ціна рядка — ОДНИМ запитом на всю таблицю (eq productId), не N.
  const prices = useCollection(productPricesCollection);
  const types = useCollection(priceTypesCollection);
  const { data: priceRows } = useLiveQuery({
    query: (q) =>
      q.from({ p: prices }).where(({ p }) => eq(p.productId, productId)),
  });
  const { data: typeRows } = useLiveQuery({
    query: (q) => q.from({ t: types }),
  });
  const defaultTypeId = typeRows.find((tp) => tp.isDefault)?.id;
  const priceOf = (modId: string) =>
    priceRows.find(
      (p) => p.modificationId === modId && p.priceTypeId === defaultTypeId,
    );

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
              name={mod.texts[active] || mod.texts[primary] || ''}
              sku={mod.sku}
              isDefault={mod.isDefault}
              thumb={imageKeys(images, mod.id)[0]}
              stockStatus={mod.stockStatus}
              error={card.modificationErrors[mod.id]}
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
              onClick={() => {
                if (deleteId) remove(deleteId);
                setDeleteId(null);
              }}
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
