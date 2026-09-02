import { useState } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { useCollection, orderStatusesCollection } from 'simplycms/admin-data';
import { reorderOrderStatus, setDefaultOrderStatus } from 'simplycms/admin-server';
import type { OrderStatus } from 'simplycms/schema/types';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from 'simplycms/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'simplycms/ui/alert-dialog';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

interface StatusFormData {
  name: string;
  code: string;
  color: string;
  is_default: boolean;
}

/**
 * Перша сторінка адмінки на чистому Postgres (Е1б, Task 10).
 *
 * Читання — жива колекція (`useLiveQuery`, eager-режим К3-5): дані вже в
 * памʼяті синхронно, сортування — на клієнті. Мутації — оптимістичні
 * (`collection.insert/update/delete`) із авто-rollback і write-back через
 * serverFn з `simplycms/admin-server` (Task 8), крім `setDefault`/`reorder`
 * — вони міняють N рядків одразу, тож завершуються `refetch()`, а не
 * write-back одного рядка (межа канону write-back, не виняток).
 */
export default function OrderStatuses() {
  const t = useT();
  const collection = useCollection(orderStatusesCollection);
  // 🔴 Форма 0.3.6 — обʼєкт { query }; dependency-масиви legacy.
  const { data: statuses, isLoading } = useLiveQuery({
    query: (q) => q.from({ s: collection }).orderBy(({ s }) => s.sortOrder, 'asc'),
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<OrderStatus | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<OrderStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<StatusFormData>({
    name: '',
    code: '',
    color: '#6B7280',
    is_default: false,
  });

  /**
   * setDefault/reorder — серверні операції, що міняють N рядків: write-back
   * одного не описує стан → refetch. Це МЕЖА канону write-back, не виняток.
   */
  const applyDefault = async (id: string) => {
    await setDefaultOrderStatus({ data: { id } });
    await collection.utils.refetch();
  };

  /** create: клієнт рахує max+1 — eager-колекція і є повна копія. */
  const handleCreate = (form: StatusFormData) => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error(t('admin.orders.statuses.requiredFields'));
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
      createdAt: new Date().toISOString(),
    } as OrderStatus);
    // 🔴 Failure-state збережений (рев'ю р3, як у старій сторінці): діалог
    // закривається ЛИШЕ після успішного персисту — при помилці введене
    // лишається у формі. Рядок у СПИСКУ все одно зʼявляється миттєво
    // (оптимістично) — DoD «створення миттєве» не страждає. `isSubmitting`
    // — заміна старого mutation.isPending на кнопці Save.
    setIsSubmitting(true);
    tx.isPersisted.promise
      .then(async () => {
        handleCloseDialog();
        // 🔴 Двофазність ЧЕСНА (рев'ю р2): insert уже закомічено, тож
        // падіння setDefault — НЕ createFailed. Рядок створено — кажемо
        // це, а про дефолт — окремою помилкою.
        toast.success(t('admin.orders.statuses.created'));
        if (form.is_default) {
          try {
            await applyDefault(id);
          } catch (e) {
            toast.error(
              t('admin.orders.statuses.updateFailed') + ' ' + (e as Error).message,
            );
          }
        }
      })
      .catch((e: Error) =>
        toast.error(t('admin.orders.statuses.createFailed') + ' ' + e.message),
      )
      .finally(() => setIsSubmitting(false));
  };

  const handleUpdate = (id: string, form: StatusFormData) => {
    const tx = collection.update(id, (draft) => {
      draft.name = form.name;
      draft.code = form.code;
      draft.color = form.color;
    });
    setIsSubmitting(true);
    tx.isPersisted.promise
      .then(async () => {
        handleCloseDialog();
        // 🔴 Та сама чесна двофазність, що в create (рев'ю р3): update вже
        // закомічений окремим withActor — statusUpdated ДО default-фази,
        // її падіння — окремою помилкою, не «оновлення не вдалося».
        toast.success(t('common.statusUpdated'));
        if (form.is_default) {
          try {
            await applyDefault(id);
          } catch (e) {
            toast.error(
              t('admin.orders.statuses.updateFailed') + ' ' + (e as Error).message,
            );
          }
        }
      })
      .catch((e: Error) =>
        toast.error(t('admin.orders.statuses.updateFailed') + ' ' + e.message),
      )
      .finally(() => setIsSubmitting(false));
  };

  const handleDelete = (id: string) => {
    const tx = collection.delete(id);
    tx.isPersisted.promise
      .then(() => toast.success(t('admin.orders.statuses.deleted')))
      .catch((e: Error) =>
        toast.error(t('admin.orders.statuses.deleteFailed') + ' ' + e.message),
      );
    setDeleteStatus(null);
  };

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    try {
      await reorderOrderStatus({ data: { id, direction } });
      await collection.utils.refetch();
    } catch (e) {
      toast.error(
        t('admin.orders.statuses.reorderFailed') + ' ' + (e as Error).message,
      );
    }
  };

  const handleOpenCreate = () => {
    setEditingStatus(null);
    setFormData({
      name: '',
      code: '',
      color: '#6B7280',
      is_default: false,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (status: OrderStatus) => {
    setEditingStatus(status);
    setFormData({
      name: status.name,
      code: status.code,
      color: status.color || '#6B7280',
      is_default: status.isDefault,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingStatus(null);
    setFormData({
      name: '',
      code: '',
      color: '#6B7280',
      is_default: false,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error(t('admin.orders.statuses.requiredFields'));
      return;
    }

    if (editingStatus) {
      handleUpdate(editingStatus.id, formData);
    } else {
      handleCreate(formData);
    }
  };

  const generateCode = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-zа-яіїєґ0-9\s]/gi, '')
      .replace(/\s+/g, '_')
      .slice(0, 20);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {t('admin.common.placeholder.orderStatuses')}
          </h1>
          <p className="text-muted-foreground">
            {t('admin.orders.statuses.subtitle')}
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.orders.statuses.add')}
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>{t('common.code')}</TableHead>
              <TableHead>{t('common.color')}</TableHead>
              <TableHead>{t('common.byDefault')}</TableHead>
              <TableHead className="w-32">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statuses.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  {t('admin.orders.statuses.empty')}
                </TableCell>
              </TableRow>
            ) : (
              statuses.map((status, index) => (
                <TableRow key={status.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === 0}
                        onClick={() => handleReorder(status.id, 'up')}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === statuses.length - 1}
                        onClick={() => handleReorder(status.id, 'down')}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{status.name}</TableCell>
                  <TableCell>
                    <code className="px-2 py-1 bg-muted rounded text-sm">
                      {status.code}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ backgroundColor: status.color || '#6B7280' }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {status.color || '#6B7280'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {status.isDefault && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {t('common.byDefault')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(status)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteStatus(status)}
                        disabled={status.isDefault}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStatus
                ? t('admin.orders.statuses.edit')
                : t('admin.orders.statuses.new')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('common.nameRequiredLabel')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    name,
                    code: prev.code || generateCode(name),
                  }));
                }}
                placeholder={t('admin.orders.statuses.namePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">
                {t('admin.orders.statuses.codeRequired')}
              </Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, code: e.target.value }))
                }
                placeholder="processing"
              />
              <p className="text-xs text-muted-foreground">
                {t('admin.orders.statuses.codeHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">{t('common.color')}</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, color: e.target.value }))
                  }
                  className="w-12 h-10 rounded border cursor-pointer"
                />
                <Input
                  value={formData.color}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, color: e.target.value }))
                  }
                  placeholder="#6B7280"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_default">{t('common.byDefault')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('admin.orders.statuses.autoAssign')}
                </p>
              </div>
              <Switch
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_default: checked }))
                }
                // К3-15: зняти дефолт без призначення нового не можна — нуль
                // дефолтів заборонений доменом (див. removeManyOrderStatusesOp
                // і setDefaultOrderStatusOp). Редагування вже-дефолтного рядка
                // тому не дає зняти прапорець тут — лише призначити дефолтом
                // ІНШИЙ рядок.
                disabled={!!editingStatus?.isDefault}
                title={
                  editingStatus?.isDefault
                    ? t('admin.orders.statuses.autoAssign')
                    : undefined
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {editingStatus ? t('common.save') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteStatus}
        onOpenChange={() => setDeleteStatus(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.orders.statuses.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.orders.statuses.deleteText', {
                name: deleteStatus?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteStatus && handleDelete(deleteStatus.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
