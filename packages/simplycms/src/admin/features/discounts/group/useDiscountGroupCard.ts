import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { discountGroupsCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import {
  fromDateTimeLocal,
  toDateTimeLocal,
} from '../../../lib/datetime-local';
import { reportTxError } from '../../../lib/report-tx-error';
import { useSeedOnce } from '../../catalog-dictionaries/useSeedOnce';
import {
  discountGroupFormSchema,
  ROOT_GROUP,
  type DiscountGroupFormInput,
  type DiscountGroupFormValues,
} from './discount-group-form-schema';
import { parentOptions } from './parent-options';

const empty = (parentId: string | undefined): DiscountGroupFormInput => ({
  name: '',
  description: '',
  operator: 'and',
  parentGroupId: parentId ?? ROOT_GROUP,
  priority: 0,
  isActive: true,
  startsAt: '',
  endsAt: '',
});

/**
 * Стан картки групи знижок: insert/update — фабрика через колекцію
 * (guard циклу й пари дат — на сервері, Е6в-17). Незмінена дата в patch не
 * потрапляє зовсім: сервер лишає вихідний момент (Е6в-22 ред.2).
 */
export function useDiscountGroupCard(
  groupId: string | undefined,
  parentId: string | undefined,
) {
  const t = useT();
  const navigate = useNavigate();
  const isNew = !groupId || groupId === 'new';
  const collection = useCollection(discountGroupsCollection);
  const { data: all, isLoading } = useLiveQuery({
    query: (q) => q.from({ g: collection }).orderBy(({ g }) => g.name, 'asc'),
  });
  const row = isNew ? undefined : all.find((g) => g.id === groupId);
  const parents = parentOptions(all, isNew ? undefined : groupId);

  const form = useForm<
    DiscountGroupFormInput,
    unknown,
    DiscountGroupFormValues
  >({
    resolver: zodResolver(discountGroupFormSchema),
    defaultValues: empty(parentId),
  });
  const { reset } = form;

  useSeedOnce(row?.id, () => {
    if (row)
      reset({
        name: row.name,
        description: row.description ?? '',
        operator: row.operator,
        parentGroupId: row.parentGroupId ?? ROOT_GROUP,
        priority: row.priority,
        isActive: row.isActive,
        startsAt: toDateTimeLocal(row.startsAt),
        endsAt: toDateTimeLocal(row.endsAt),
      });
  });

  const onSubmit = async (v: DiscountGroupFormValues) => {
    const parentGroupId =
      v.parentGroupId === ROOT_GROUP ? null : v.parentGroupId;
    const description = v.description.trim() || null;
    const tx = row
      ? collection.update(row.id, (d) => {
          d.name = v.name;
          d.description = description;
          d.operator = v.operator;
          d.parentGroupId = parentGroupId;
          d.priority = v.priority;
          d.isActive = v.isActive;
          if (v.startsAt !== toDateTimeLocal(row.startsAt))
            d.startsAt = fromDateTimeLocal(v.startsAt);
          if (v.endsAt !== toDateTimeLocal(row.endsAt))
            d.endsAt = fromDateTimeLocal(v.endsAt);
        })
      : collection.insert({
          id: crypto.randomUUID(), // Е0: ключ генерує клієнт
          name: v.name,
          description,
          operator: v.operator,
          parentGroupId,
          priority: v.priority,
          isActive: v.isActive,
          startsAt: fromDateTimeLocal(v.startsAt),
          endsAt: fromDateTimeLocal(v.endsAt),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      reportTxError(t, e);
      return;
    }
    toast.success(
      row
        ? t('admin.discounts.groupUpdated')
        : t('admin.discounts.groupCreated'),
    );
    void navigate({ to: adminPath('discounts') });
  };

  return { isNew, isLoading, row, parents, form, onSubmit };
}
