import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { shippingMethodsCollection, useCollection } from 'simplycms/admin-data';
import { SHIPPING_PROVIDER } from 'simplycms/contracts/shipping-providers';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import { useSeedOnce } from '../../catalog-dictionaries/useSeedOnce';
import {
  shippingMethodFormSchema,
  type ShippingMethodFormInput,
  type ShippingMethodFormValues,
} from './shipping-method-form-schema';

const EMPTY: ShippingMethodFormInput = {
  provider: SHIPPING_PROVIDER.address,
  name: '',
  code: '',
  description: '',
  pricing: 'rates',
  icon: '',
  sortOrder: 0,
  isActive: true,
};

/**
 * Стан картки способу доставки. `provider` пишеться лише в insert
 * (`insertOnly`, Е6а-7): зміна осиротила б точки й тарифи, тож у patch
 * update його немає.
 */
export function useShippingMethodCard(methodId: string | undefined) {
  const t = useT();
  const navigate = useNavigate();
  const isNew = !methodId || methodId === 'new';
  const collection = useCollection(shippingMethodsCollection);
  const { data: all, isLoading } = useLiveQuery({
    query: (q) => q.from({ m: collection }),
  });
  const row = isNew ? undefined : all.find((m) => m.id === methodId);

  const form = useForm<
    ShippingMethodFormInput,
    unknown,
    ShippingMethodFormValues
  >({
    resolver: zodResolver(shippingMethodFormSchema),
    defaultValues: EMPTY,
  });
  const { reset } = form;

  useSeedOnce(row?.id, () => {
    if (row)
      reset({
        provider: row.provider as ShippingMethodFormInput['provider'],
        name: row.name,
        code: row.code,
        description: row.description ?? '',
        pricing: row.pricing,
        icon: row.icon ?? '',
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      });
  });

  // Поки видалення в дорозі, оптимістично рядка вже немає — без прапорця
  // сторінка блимнула б станом «не знайдено» перед переходом на список.
  const [deleting, setDeleting] = useState(false);
  const goList = () => navigate({ to: adminPath('shipping/methods') });

  const onSubmit = async (v: ShippingMethodFormValues) => {
    const id = row?.id ?? crypto.randomUUID(); // Е0: ключ генерує клієнт
    const patch = {
      code: v.code,
      name: v.name,
      description: v.description.trim() || null,
      pricing: v.pricing,
      icon: v.icon || null,
      sortOrder: v.sortOrder,
      isActive: v.isActive,
    };
    const tx = row
      ? collection.update(id, (d) => Object.assign(d, patch))
      : collection.insert({
          id,
          provider: v.provider,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          ...patch,
        });
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      reportTxError(t, e);
      return;
    }
    toast.success(
      row ? t('common.changesSaved') : t('admin.shipping.methods.created'),
    );
    // Новий спосіб із тарифами — на його картку: блок «Тарифи» з'являється
    // лише для збереженого способу.
    if (!row && v.pricing === 'rates')
      navigate({
        to: adminPath('shipping/methods/$methodId'),
        params: { methodId: id },
      });
    else goList();
  };

  const handleDelete = () => {
    if (!row) return;
    setDeleting(true);
    collection
      .delete(row.id)
      .isPersisted.promise.then(() => {
        toast.success(t('admin.shipping.methods.deleted'));
        goList();
      })
      .catch((e: unknown) => {
        setDeleting(false);
        reportTxError(t, e);
      });
  };

  return { isNew, isLoading, deleting, row, form, onSubmit, handleDelete };
}
