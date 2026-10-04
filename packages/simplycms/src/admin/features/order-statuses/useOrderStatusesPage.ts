import { useState, type FormEvent } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { toast } from 'sonner';
import { useCollection, orderStatusesCollection } from 'simplycms/admin-data';
import { reorderOrderStatus } from 'simplycms/admin-server';
import type { OrderStatus } from 'simplycms/schema/types';
import { useT } from 'simplycms/i18n';
import { useStatusPersist } from './useStatusPersist';
import { EMPTY_STATUS_FORM, type StatusFormData } from './form-data';

/**
 * Стан і мутації сторінки статусів замовлень. Читання — жива eager-колекція;
 * мутації — оптимістичні з write-back, крім `setDefault`/`reorder` (міняють
 * N рядків — межа канону write-back, завершуються `refetch()`).
 */
export function useOrderStatusesPage() {
  const t = useT();
  const collection = useCollection(orderStatusesCollection);
  // 🔴 Форма 0.3.6 — обʼєкт { query }; dependency-масиви legacy.
  const { data: statuses, isLoading } = useLiveQuery({
    query: (q) =>
      q.from({ s: collection }).orderBy(({ s }) => s.sortOrder, 'asc'),
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrderStatus | null>(null);
  const [deleting, setDeleting] = useState<OrderStatus | null>(null);
  const [form, setForm] = useState<StatusFormData>(EMPTY_STATUS_FORM);

  const close = () => {
    setIsDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_STATUS_FORM);
  };

  const { isSubmitting, persist } = useStatusPersist(collection, close);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toast.error(t('admin.orders.statuses.requiredFields'));
      return;
    }
    if (editing) {
      // 🔴 `code` у patch не входить: він незмінний (Е5-6, insertOnly).
      const tx = collection.update(editing.id, (draft) => {
        draft.name = form.name;
        draft.color = form.color;
      });
      persist(
        tx,
        editing.id,
        form.is_default,
        'common.statusUpdated',
        'admin.orders.statuses.updateFailed',
      );
      return;
    }
    const id = crypto.randomUUID(); // Е0: ключ генерує клієнт
    const sortOrder =
      statuses.reduce((max, s) => Math.max(max, s.sortOrder), -1) + 1;
    const tx = collection.insert({
      id,
      name: form.name,
      code: form.code,
      color: form.color,
      sortOrder,
      isDefault: false,
      createdAt: new Date(),
    } as OrderStatus);
    persist(
      tx,
      id,
      form.is_default,
      'admin.orders.statuses.created',
      'admin.orders.statuses.createFailed',
    );
  };

  const remove = (id: string) => {
    collection
      .delete(id)
      .isPersisted.promise.then(() =>
        toast.success(t('admin.orders.statuses.deleted')),
      )
      .catch((e: Error) =>
        toast.error(t('admin.orders.statuses.deleteFailed') + ' ' + e.message),
      );
    setDeleting(null);
  };

  const reorder = async (id: string, direction: 'up' | 'down') => {
    try {
      await reorderOrderStatus({ data: { id, direction } });
      await collection.utils.refetch();
    } catch (e) {
      toast.error(
        t('admin.orders.statuses.reorderFailed') + ' ' + (e as Error).message,
      );
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_STATUS_FORM);
    setIsDialogOpen(true);
  };

  const openEdit = (s: OrderStatus) => {
    setEditing(s);
    setForm({
      name: s.name,
      code: s.code,
      color: s.color || EMPTY_STATUS_FORM.color,
      is_default: s.isDefault,
    });
    setIsDialogOpen(true);
  };

  return {
    statuses,
    isLoading,
    isDialogOpen,
    setIsDialogOpen,
    editing,
    deleting,
    setDeleting,
    isSubmitting,
    form,
    setForm,
    close,
    submit,
    remove,
    reorder,
    openCreate,
    openEdit,
  };
}
