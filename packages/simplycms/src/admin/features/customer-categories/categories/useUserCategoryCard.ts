import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCollection, userCategoriesCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import { useSeedOnce } from '../../catalog-dictionaries/useSeedOnce';
import {
  NO_PRICE_TYPE,
  userCategoryFormSchema,
  type UserCategoryFormInput,
  type UserCategoryFormValues,
} from './user-category-form-schema';

const EMPTY: UserCategoryFormInput = {
  name: '',
  code: '',
  description: '',
  priceTypeId: NO_PRICE_TYPE,
};

/**
 * Стан картки категорії. `isDefault` у формі немає (readonly для фабрики):
 * дефолт ставить кнопка списку. Видалення — `collection.delete`, відмови
 * Е6в-18 показує `reportTxError`.
 */
export function useUserCategoryCard(categoryId: string | undefined) {
  const t = useT();
  const navigate = useNavigate();
  const isNew = !categoryId || categoryId === 'new';
  const collection = useCollection(userCategoriesCollection);
  const { data: all, isLoading } = useLiveQuery({
    query: (q) => q.from({ c: collection }),
  });
  const row = isNew ? undefined : all.find((c) => c.id === categoryId);

  const form = useForm<UserCategoryFormInput, unknown, UserCategoryFormValues>({
    resolver: zodResolver(userCategoryFormSchema),
    defaultValues: EMPTY,
  });
  const { reset } = form;

  useSeedOnce(row?.id, () => {
    if (row)
      reset({
        name: row.name,
        code: row.code,
        description: row.description ?? '',
        priceTypeId: row.priceTypeId ?? NO_PRICE_TYPE,
      });
  });

  // Поки видалення в дорозі, рядка вже немає — без прапорця блимнув би
  // стан «не знайдено» перед переходом на список.
  const [deleting, setDeleting] = useState(false);
  const goList = () => navigate({ to: adminPath('user-categories') });

  const onSubmit = async (v: UserCategoryFormValues) => {
    const id = row?.id ?? crypto.randomUUID(); // Е0: ключ генерує клієнт
    const description = v.description.trim() || null;
    const priceTypeId = v.priceTypeId === NO_PRICE_TYPE ? null : v.priceTypeId;
    const tx = row
      ? collection.update(id, (d) => {
          d.name = v.name;
          d.code = v.code;
          d.description = description;
          d.priceTypeId = priceTypeId;
        })
      : collection.insert({
          id,
          name: v.name,
          code: v.code,
          description,
          priceTypeId,
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
      row ? t('common.changesSaved') : t('admin.users.categories.created'),
    );
    goList();
  };

  const handleDelete = () => {
    if (!row) return;
    setDeleting(true);
    collection
      .delete(row.id)
      .isPersisted.promise.then(() => {
        toast.success(t('admin.users.categories.deleted'));
        goList();
      })
      .catch((e: unknown) => {
        setDeleting(false);
        reportTxError(t, e);
      });
  };

  return { isNew, isLoading, deleting, row, form, onSubmit, handleDelete };
}
