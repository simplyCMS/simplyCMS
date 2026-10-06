import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  pickupPointsCollection,
  shippingZonesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import { usePickupMethodOptions } from './usePickupMethodOptions';
import { useSeedOnce } from '../../catalog-dictionaries/useSeedOnce';
import {
  NO_ZONE,
  pickupPointFormSchema,
  type PickupPointFormInput,
  type PickupPointFormValues,
} from './pickup-point-form-schema';

const EMPTY: PickupPointFormInput = {
  methodId: '',
  name: '',
  city: '',
  address: '',
  phone: '',
  zoneId: NO_ZONE,
  sortOrder: 0,
  isActive: true,
};

/**
 * Стан картки точки видачі. Способи в select — лише ті, чий провайдер везе
 * до точки (`destination === 'pickup-point'`, Е6а-12); єдиний — обирається
 * сам. `methodId` пишеться лише в insert (`insertOnly`).
 */
export function usePickupPointCard(pointId: string | undefined) {
  const t = useT();
  const navigate = useNavigate();
  const isNew = !pointId || pointId === 'new';
  const collection = useCollection(pickupPointsCollection);
  const zonesCollection = useCollection(shippingZonesCollection);
  const { data: all, isLoading } = useLiveQuery({
    query: (q) => q.from({ p: collection }),
  });
  const { data: zones } = useLiveQuery({
    query: (q) =>
      q.from({ z: zonesCollection }).orderBy(({ z }) => z.sortOrder, 'asc'),
  });
  const row = isNew ? undefined : all.find((p) => p.id === pointId);
  const methodOptions = usePickupMethodOptions();

  const form = useForm<PickupPointFormInput, unknown, PickupPointFormValues>({
    resolver: zodResolver(pickupPointFormSchema),
    defaultValues: EMPTY,
  });
  const { reset, setValue, getValues } = form;

  useSeedOnce(row?.id, () => {
    if (row)
      reset({
        methodId: row.methodId,
        name: row.name,
        city: row.city,
        address: row.address,
        phone: row.phone ?? '',
        zoneId: row.zoneId ?? NO_ZONE,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      });
  });

  const onlyMethodId =
    methodOptions.length === 1 ? methodOptions[0]!.value : '';
  useEffect(() => {
    if (isNew && onlyMethodId && !getValues('methodId'))
      setValue('methodId', onlyMethodId);
  }, [isNew, onlyMethodId, getValues, setValue]);

  // Поки видалення в дорозі, рядка вже немає — без прапорця блимнув би
  // стан «не знайдено» перед переходом на список.
  const [deleting, setDeleting] = useState(false);
  const goList = () => navigate({ to: adminPath('shipping/pickup-points') });

  const onSubmit = async (v: PickupPointFormValues) => {
    const id = row?.id ?? crypto.randomUUID(); // Е0: ключ генерує клієнт
    const patch = {
      name: v.name,
      city: v.city,
      address: v.address,
      phone: v.phone || null,
      zoneId: v.zoneId === NO_ZONE ? null : v.zoneId,
      sortOrder: v.sortOrder,
      isActive: v.isActive,
    };
    const tx = row
      ? collection.update(id, (d) => Object.assign(d, patch))
      : collection.insert({
          id,
          methodId: v.methodId,
          workingHours: {},
          coordinates: null,
          isSystem: false,
          createdAt: new Date(),
          ...patch,
        });
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      reportTxError(t, e);
      return;
    }
    toast.success(
      row ? t('common.changesSaved') : t('admin.shipping.points.created'),
    );
    goList();
  };

  const handleDelete = () => {
    if (!row) return;
    setDeleting(true);
    collection
      .delete(row.id)
      .isPersisted.promise.then(() => {
        toast.success(t('admin.shipping.points.deleted'));
        goList();
      })
      .catch((e: unknown) => {
        setDeleting(false);
        reportTxError(t, e);
      });
  };

  return {
    isNew,
    isLoading,
    deleting,
    row,
    form,
    methodOptions,
    zones,
    onSubmit,
    handleDelete,
  };
}
