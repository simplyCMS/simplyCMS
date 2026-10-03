import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  sectionPropertiesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import {
  EMPTY_PROPERTY,
  propertyFormSchema,
  toPropertyPatch,
  type PropertyFormInput,
  type PropertyFormValues,
} from './property-form-schema';

/**
 * Стан картки властивості: зріз on-demand колекції `where id`, форма,
 * збереження (тип незмінний, Е4-5 — update його не несе) і видалення.
 */
export function usePropertyCard(propertyId: string) {
  const t = useT();
  const navigate = useNavigate();
  const collection = useCollection(sectionPropertiesCollection);
  const { data: rows, isLoading } = useLiveQuery(
    (q) => q.from({ p: collection }).where(({ p }) => eq(p.id, propertyId)),
    [propertyId],
  );
  const row = rows.find((p) => p.id === propertyId);

  const form = useForm<PropertyFormInput, unknown, PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: EMPTY_PROPERTY,
  });
  const { reset } = form;

  // Скидання форми лише при зміні РЯДКА (id), а не на кожен write-back:
  // інакше відповідь сервера перетерла б незбережене введення.
  useEffect(() => {
    if (row)
      reset({
        name: row.name,
        slug: row.slug,
        propertyType: row.propertyType,
        isRequired: row.isRequired,
        isFilterable: row.isFilterable,
        hasPage: row.hasPage,
        sortOrder: row.sortOrder,
      });
  }, [row?.id, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Поки видалення в дорозі, оптимістично рядка вже немає — без прапорця
  // сторінка блимнула б станом «не знайдено» перед переходом на список.
  const [deleting, setDeleting] = useState(false);
  const goList = () => navigate({ to: adminPath('properties') });

  const onSubmit = async (v: PropertyFormValues) => {
    if (!row) return;
    const patch = toPropertyPatch(v);
    const tx = collection.update(row.id, (d) => {
      Object.assign(d, patch);
    });
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      reportTxError(t, e);
      return;
    }
    toast.success(t('admin.properties.saved'));
  };

  const handleDelete = () => {
    if (!row) return;
    setDeleting(true);
    collection
      .delete(row.id)
      .isPersisted.promise.then(() => {
        toast.success(t('admin.properties.deleted'));
        goList();
      })
      .catch((e: unknown) => {
        // Бібліотека вже повернула рядок — користувач лишається на картці.
        setDeleting(false);
        reportTxError(t, e);
      });
  };

  return { isLoading, deleting, row, form, onSubmit, handleDelete };
}
