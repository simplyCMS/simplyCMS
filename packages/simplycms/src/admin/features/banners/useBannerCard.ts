import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  bannersCollection,
  sectionsCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { adminPath } from '../../lib/adminLinks';
import {
  applyServerValidation,
  formErrorBinding,
} from '../../lib/apply-server-validation';
import { fromDateTimeLocal, toDateTimeLocal } from '../../lib/datetime-local';
import { reportTxError } from '../../lib/report-tx-error';
import { useSeedOnce } from '../catalog-dictionaries/useSeedOnce';
import { changedFields, toFields, toFormValues } from './banner-form-mapping';
import {
  EMPTY_BANNER,
  bannerFormSchema,
  type BannerFormInput,
  type BannerFormValues,
} from './banner-form-schema';

/** Поля, під якими UI показує серверну помилку (КАНОН Task 3). */
const SERVER_FIELDS = ['sectionId', 'dateTo', 'scheduleTimeTo', 'buttons'];

/**
 * Стан картки банера. `id` нового банера генерується НАПЕРЕД: три
 * `ImageUpload` привʼязують файли до `entityId`, а сервер звіряє, що референс
 * належить цьому рядку (Е6д-1).
 */
export function useBannerCard(bannerId: string | undefined) {
  const t = useT();
  const navigate = useNavigate();
  const isNew = !bannerId || bannerId === 'new';
  const collection = useCollection(bannersCollection);
  const { data: all, isLoading } = useLiveQuery({
    query: (q) => q.from({ b: collection }),
  });
  const sectionsCol = useCollection(sectionsCollection);
  const { data: sections } = useLiveQuery({
    query: (q) =>
      q.from({ s: sectionsCol }).orderBy(({ s }) => s.sortOrder, 'asc'),
  });
  const row = isNew ? undefined : all.find((b) => b.id === bannerId);
  const [newId] = useState(() => crypto.randomUUID());
  const entityId = row?.id ?? newId;

  const form = useForm<BannerFormInput, unknown, BannerFormValues>({
    resolver: zodResolver(bannerFormSchema),
    defaultValues: EMPTY_BANNER,
  });
  const { reset } = form;
  useSeedOnce(row?.id, () => row && reset(toFormValues(row)));

  // Поки видалення в дорозі, рядка вже немає — без прапорця блимнув би
  // стан «не знайдено» перед переходом на список.
  const [deleting, setDeleting] = useState(false);
  const goList = () => navigate({ to: adminPath('banners') });

  /** Дата йде в patch лише змінена: круговий рядок губить секунди й зсуває пояс. */
  const datePatch = (v: BannerFormValues, r: NonNullable<typeof row>) => ({
    ...(v.dateFrom !== toDateTimeLocal(r.dateFrom) && {
      dateFrom: fromDateTimeLocal(v.dateFrom),
    }),
    ...(v.dateTo !== toDateTimeLocal(r.dateTo) && {
      dateTo: fromDateTimeLocal(v.dateTo),
    }),
  });

  const onSubmit = async (v: BannerFormValues) => {
    let tx;
    if (row) {
      const patch = { ...changedFields(row, v), ...datePatch(v, row) };
      if (Object.keys(patch).length === 0) return goList();
      tx = collection.update(row.id, (d) => {
        Object.assign(d, patch);
      });
    } else {
      const now = new Date();
      tx = collection.insert({
        ...toFields(v),
        id: entityId,
        dateFrom: fromDateTimeLocal(v.dateFrom),
        dateTo: fromDateTimeLocal(v.dateTo),
        createdAt: now,
        updatedAt: now,
      });
    }
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      const b = formErrorBinding(form, SERVER_FIELDS);
      const rest = applyServerValidation(e, b.setError, {
        t,
        fieldFor: b.fieldFor,
      });
      if (rest === null || rest.length > 0) reportTxError(t, e);
      return;
    }
    toast.success(t('admin.banners.saved'));
    goList();
  };

  const handleDelete = () => {
    if (!row) return;
    setDeleting(true);
    collection
      .delete(row.id)
      .isPersisted.promise.then(() => {
        toast.success(t('admin.banners.deleted'));
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
    entityId,
    form,
    sections,
    onSubmit,
    handleDelete,
  };
}
