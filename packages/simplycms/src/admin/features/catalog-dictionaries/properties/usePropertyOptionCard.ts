import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  propertyOptionsCollection,
  sectionPropertiesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import {
  optionFormSchema,
  toOptionDraft,
  toOptionPatch,
  type OptionFormInput,
  type OptionFormValues,
} from './option-form-schema';

const EMPTY: OptionFormInput = {
  name: '',
  slug: '',
  sortOrder: 0,
  description: '',
  metaTitle: '',
  metaDescription: '',
  images: [],
};

/**
 * Стан картки опції. Один зріз `where propertyId` дає і сам рядок, і
 * кількість опцій — нова опція отримує `sortOrder` = цій кількості (з
 * колекції, не `count` з БД). id нової опції генерується НАПЕРЕД і йде і в
 * `ImageUpload`, і в insert (Е4-10).
 */
export function usePropertyOptionCard(
  propertyId: string,
  optionId: string | undefined,
) {
  const t = useT();
  const navigate = useNavigate();
  const isNew = !optionId || optionId === 'new';
  const optionsCol = useCollection(propertyOptionsCollection);
  const propertiesCol = useCollection(sectionPropertiesCollection);

  const { data: options, isLoading } = useLiveQuery({
    query: (q) =>
      q.from({ o: optionsCol }).where(({ o }) => eq(o.propertyId, propertyId)),
  });
  // Окремий isLoading властивості: без нього перша мить зрізу дала б хибне
  // «не знайдено» (Е4, фінальне рев'ю п.4).
  const { data: properties, isLoading: loadingProperty } = useLiveQuery({
    query: (q) =>
      q.from({ p: propertiesCol }).where(({ p }) => eq(p.id, propertyId)),
  });
  const property = properties.find((p) => p.id === propertyId);
  const row = isNew ? undefined : options.find((o) => o.id === optionId);
  const [newId] = useState(() => crypto.randomUUID());
  const entityId = row?.id ?? newId;

  const form = useForm<OptionFormInput, unknown, OptionFormValues>({
    resolver: zodResolver(optionFormSchema),
    defaultValues: EMPTY,
  });
  const { reset } = form;

  // Скидання лише при зміні рядка (id) або на першому завантаженні зрізу
  // для нової опції — не на кожен write-back (інакше затерло б введене).
  useEffect(() => {
    if (row)
      reset({
        name: row.name,
        slug: row.slug,
        sortOrder: row.sortOrder,
        description: row.description ?? '',
        metaTitle: row.metaTitle ?? '',
        metaDescription: row.metaDescription ?? '',
        images: row.imageUrl ? [row.imageUrl] : [],
      });
    else if (isNew && !isLoading)
      reset({ ...EMPTY, sortOrder: options.length });
  }, [row?.id, isNew, isLoading, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const goBack = () => navigate({ to: adminPath(`properties/${propertyId}`) });

  const onSubmit = async (v: OptionFormValues) => {
    const patch = toOptionPatch(v);
    const tx = row
      ? optionsCol.update(row.id, (d) => {
          Object.assign(d, patch);
        })
      : optionsCol.insert(toOptionDraft(v, entityId, propertyId, new Date()));
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      reportTxError(t, e);
      return;
    }
    toast.success(
      row
        ? t('admin.properties.options.saved')
        : t('admin.properties.options.created'),
    );
    goBack();
  };

  return {
    isNew,
    isLoading: isLoading || loadingProperty,
    property,
    row,
    entityId,
    form,
    onSubmit,
  };
}
