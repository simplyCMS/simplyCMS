import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { shippingZonesCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import { useSeedOnce } from '../../catalog-dictionaries/useSeedOnce';
import {
  joinList,
  shippingZoneFormSchema,
  splitList,
  type ShippingZoneFormInput,
  type ShippingZoneFormValues,
} from './shipping-zone-form-schema';

const EMPTY: ShippingZoneFormInput = {
  name: '',
  description: '',
  cities: '',
  regions: '',
  sortOrder: 0,
  isActive: true,
};

const sameList = (a: readonly string[] | null, b: readonly string[]) =>
  (a ?? []).join('\n') === b.join('\n');

/**
 * Стан картки зони. `isDefault` у формі немає (readonly для фабрики):
 * дефолт ставить кнопка списку. Update кладе в patch лише змінене, тож
 * незмінні масиви не перезаписуються (порівняння за вмістом, не за
 * посиланням).
 */
export function useShippingZoneCard(zoneId: string | undefined) {
  const t = useT();
  const navigate = useNavigate();
  const isNew = !zoneId || zoneId === 'new';
  const collection = useCollection(shippingZonesCollection);
  const { data: all, isLoading } = useLiveQuery({
    query: (q) => q.from({ z: collection }),
  });
  const row = isNew ? undefined : all.find((z) => z.id === zoneId);

  const form = useForm<ShippingZoneFormInput, unknown, ShippingZoneFormValues>({
    resolver: zodResolver(shippingZoneFormSchema),
    defaultValues: EMPTY,
  });
  const { reset } = form;

  useSeedOnce(row?.id, () => {
    if (row)
      reset({
        name: row.name,
        description: row.description ?? '',
        cities: joinList(row.cities),
        regions: joinList(row.regions),
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      });
  });

  // Поки видалення в дорозі, рядка вже немає — без прапорця блимнув би
  // стан «не знайдено» перед переходом на список.
  const [deleting, setDeleting] = useState(false);
  const goList = () => navigate({ to: adminPath('shipping/zones') });

  const onSubmit = async (v: ShippingZoneFormValues) => {
    const id = row?.id ?? crypto.randomUUID(); // Е0: ключ генерує клієнт
    const cities = splitList(v.cities);
    const regions = splitList(v.regions);
    const description = v.description.trim() || null;
    const tx = row
      ? collection.update(id, (d) => {
          d.name = v.name;
          d.description = description;
          if (!sameList(d.cities, cities)) d.cities = cities;
          if (!sameList(d.regions, regions)) d.regions = regions;
          d.sortOrder = v.sortOrder;
          d.isActive = v.isActive;
        })
      : collection.insert({
          id,
          name: v.name,
          description,
          cities,
          regions,
          sortOrder: v.sortOrder,
          isActive: v.isActive,
          isDefault: false,
          createdAt: new Date(),
        });
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      reportTxError(t, e);
      return;
    }
    toast.success(
      row ? t('common.changesSaved') : t('admin.shipping.zones.created'),
    );
    goList();
  };

  const handleDelete = () => {
    if (!row) return;
    setDeleting(true);
    collection
      .delete(row.id)
      .isPersisted.promise.then(() => {
        toast.success(t('admin.shipping.zones.deleted'));
        goList();
      })
      .catch((e: unknown) => {
        setDeleting(false);
        reportTxError(t, e);
      });
  };

  return { isNew, isLoading, deleting, row, form, onSubmit, handleDelete };
}
