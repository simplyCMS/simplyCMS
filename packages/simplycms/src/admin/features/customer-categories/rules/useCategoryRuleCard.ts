import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  categoryRulesCollection,
  useCollection,
  userCategoriesCollection,
} from 'simplycms/admin-data';
import { parseCategoryRuleConditions } from 'simplycms/domain/user-categories';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import { useSeedOnce } from '../../catalog-dictionaries/useSeedOnce';
import {
  ANY_CATEGORY,
  categoryRuleFormSchema,
  type CategoryRuleFormInput,
  type CategoryRuleFormValues,
} from './category-rule-form-schema';

const EMPTY: CategoryRuleFormInput = {
  name: '',
  description: '',
  fromCategoryId: ANY_CATEGORY,
  toCategoryId: '',
  priority: 0,
  isActive: true,
  conditions: { type: 'all', rules: [] },
};

/**
 * Стан картки правила: insert/update — фабрика через колекцію (guard
 * «не в ту саму категорію» і розбір умов — на сервері, Е6в-19). Умови, які
 * не пройшли розбір (рядок, вписаний в обхід Zod), засіваються порожніми —
 * власник мусить задати їх заново, а не зберегти сміття.
 */
export function useCategoryRuleCard(ruleId: string | undefined) {
  const t = useT();
  const navigate = useNavigate();
  const isNew = !ruleId || ruleId === 'new';
  const collection = useCollection(categoryRulesCollection);
  const categoriesCollection = useCollection(userCategoriesCollection);
  const { data: all, isLoading } = useLiveQuery({
    query: (q) => q.from({ r: collection }),
  });
  const { data: categories } = useLiveQuery({
    query: (q) =>
      q.from({ c: categoriesCollection }).orderBy(({ c }) => c.name, 'asc'),
  });
  const row = isNew ? undefined : all.find((r) => r.id === ruleId);

  const form = useForm<CategoryRuleFormInput, unknown, CategoryRuleFormValues>({
    resolver: zodResolver(categoryRuleFormSchema),
    defaultValues: EMPTY,
  });
  const { reset } = form;

  useSeedOnce(row?.id, () => {
    if (!row) return;
    const parsed = parseCategoryRuleConditions(row.conditions);
    reset({
      name: row.name,
      description: row.description ?? '',
      fromCategoryId: row.fromCategoryId ?? ANY_CATEGORY,
      toCategoryId: row.toCategoryId,
      priority: row.priority,
      isActive: row.isActive,
      conditions: parsed
        ? { type: parsed.type, rules: parsed.rules.map((r) => ({ ...r })) }
        : { type: 'all', rules: [] },
    });
  });

  const [deleting, setDeleting] = useState(false);
  const goList = () => navigate({ to: adminPath('user-categories/rules') });

  const onSubmit = async (v: CategoryRuleFormValues) => {
    const id = row?.id ?? crypto.randomUUID(); // Е0: ключ генерує клієнт
    const description = v.description.trim() || null;
    const fromCategoryId =
      v.fromCategoryId === ANY_CATEGORY ? null : v.fromCategoryId;
    const tx = row
      ? collection.update(id, (d) => {
          d.name = v.name;
          d.description = description;
          d.fromCategoryId = fromCategoryId;
          d.toCategoryId = v.toCategoryId;
          d.priority = v.priority;
          d.isActive = v.isActive;
          d.conditions = v.conditions;
        })
      : collection.insert({
          id,
          name: v.name,
          description,
          fromCategoryId,
          toCategoryId: v.toCategoryId,
          priority: v.priority,
          isActive: v.isActive,
          conditions: v.conditions,
          createdAt: new Date(),
        });
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      reportTxError(t, e);
      return;
    }
    toast.success(
      row ? t('common.changesSaved') : t('admin.users.rules.created'),
    );
    goList();
  };

  const handleDelete = () => {
    if (!row) return;
    setDeleting(true);
    collection
      .delete(row.id)
      .isPersisted.promise.then(() => {
        toast.success(t('admin.users.rules.deleted'));
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
    categories,
    form,
    onSubmit,
    handleDelete,
  };
}
