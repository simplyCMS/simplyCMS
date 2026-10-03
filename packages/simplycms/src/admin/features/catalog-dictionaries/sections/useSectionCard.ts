import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sectionsCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import {
  sectionFormSchema,
  toSectionDraft,
  toSectionPatch,
  type SectionFormInput,
  type SectionFormValues,
} from './section-form-schema';

const EMPTY: SectionFormInput = {
  name: '',
  slug: '',
  description: '',
  metaTitle: '',
  metaDescription: '',
  sortOrder: 0,
  isActive: true,
  images: [],
};

/**
 * Стан картки розділу: рядок із живої колекції, форма, збереження й
 * видалення. Для нового розділу id генерується НАПЕРЕД (Е0/Е4-10):
 * `ImageUpload` привʼязує файл до `entityId`, ще до першого збереження.
 */
export function useSectionCard(sectionId: string | undefined) {
  const t = useT();
  const navigate = useNavigate();
  const isNew = !sectionId || sectionId === 'new';
  const collection = useCollection(sectionsCollection);
  const { data: all, isLoading } = useLiveQuery({
    query: (q) => q.from({ s: collection }),
  });
  const row = isNew ? undefined : all.find((s) => s.id === sectionId);
  const [newId] = useState(() => crypto.randomUUID());
  const entityId = row?.id ?? newId;

  const form = useForm<SectionFormInput, unknown, SectionFormValues>({
    resolver: zodResolver(sectionFormSchema),
    defaultValues: EMPTY,
  });
  const { reset } = form;

  useEffect(() => {
    if (row)
      reset({
        name: row.name,
        slug: row.slug,
        description: row.description ?? '',
        metaTitle: row.metaTitle ?? '',
        metaDescription: row.metaDescription ?? '',
        sortOrder: row.sortOrder,
        isActive: row.isActive,
        images: row.imageUrl ? [row.imageUrl] : [],
      });
  }, [row?.id, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const goList = () => navigate({ to: adminPath('sections') });

  const onSubmit = async (v: SectionFormValues) => {
    const patch = toSectionPatch(v);
    const tx = row
      ? collection.update(row.id, (d) => {
          Object.assign(d, patch);
        })
      : collection.insert(toSectionDraft(v, entityId, new Date()));
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      reportTxError(t, e);
      return;
    }
    toast.success(
      row ? t('admin.sections.saved') : t('admin.sections.created'),
    );
    goList();
  };

  const handleDelete = () => {
    if (!row) return;
    collection
      .delete(row.id)
      .isPersisted.promise.then(() => {
        toast.success(t('admin.sections.deleted'));
        goList();
      })
      .catch((e: unknown) => reportTxError(t, e));
  };

  return { isNew, isLoading, row, entityId, form, onSubmit, handleDelete };
}
