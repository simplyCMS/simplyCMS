import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { priceTypesCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import {
  priceTypeFormSchema,
  type PriceTypeFormInput,
  type PriceTypeFormValues,
} from './price-type-form-schema';
import { usePriceTypeDefault } from './usePriceTypeDefault';

const EMPTY: PriceTypeFormInput = {
  name: '',
  code: '',
  sortOrder: 0,
  isDefault: false,
};

/**
 * Стан картки типу ціни. Збереження — `insert`/`update` (без `isDefault`:
 * readonly), а дефолт — окремою фазою `setDefaultPriceType` ПІСЛЯ персисту.
 * Двофазність чесна: падіння дефолту не маскується під «не збережено» —
 * рядок уже є.
 */
export function usePriceTypeCard(priceTypeId: string | undefined) {
  const t = useT();
  const navigate = useNavigate();
  const isNew = !priceTypeId || priceTypeId === 'new';
  const collection = useCollection(priceTypesCollection);
  const applyDefault = usePriceTypeDefault();
  const { data: all, isLoading } = useLiveQuery({
    query: (q) => q.from({ p: collection }),
  });
  const row = isNew ? undefined : all.find((p) => p.id === priceTypeId);

  const form = useForm<PriceTypeFormInput, unknown, PriceTypeFormValues>({
    resolver: zodResolver(priceTypeFormSchema),
    defaultValues: EMPTY,
  });
  const { reset } = form;

  useEffect(() => {
    if (row)
      reset({
        name: row.name,
        code: row.code,
        sortOrder: row.sortOrder,
        isDefault: row.isDefault,
      });
  }, [row?.id, row?.isDefault, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const goList = () => navigate({ to: adminPath('price-types') });

  const onSubmit = async (v: PriceTypeFormValues) => {
    const id = row?.id ?? crypto.randomUUID(); // Е0: ключ генерує клієнт
    const tx = row
      ? collection.update(id, (d) => {
          d.name = v.name;
          d.code = v.code;
          d.sortOrder = v.sortOrder;
        })
      : collection.insert({
          id,
          name: v.name,
          code: v.code,
          sortOrder: v.sortOrder,
          isDefault: false,
          createdAt: new Date(),
        });
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      reportTxError(t, e);
      return;
    }
    toast.success(row ? t('common.changesSaved') : t('admin.prices.created'));
    if (v.isDefault && !row?.isDefault) {
      try {
        await applyDefault(id);
      } catch (e) {
        reportTxError(t, e);
      }
    }
    goList();
  };

  const handleDelete = () => {
    if (!row) return;
    collection
      .delete(row.id)
      .isPersisted.promise.then(() => {
        toast.success(t('admin.prices.deleted'));
        goList();
      })
      .catch((e: unknown) => reportTxError(t, e));
  };

  return { isNew, isLoading, row, form, onSubmit, handleDelete };
}
