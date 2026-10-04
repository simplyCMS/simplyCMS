import { Plus } from 'lucide-react';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
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
import { StatusFormDialog } from '../features/order-statuses/StatusFormDialog';
import { StatusesTable } from '../features/order-statuses/StatusesTable';
import { useOrderStatusesPage } from '../features/order-statuses/useOrderStatusesPage';

/**
 * Довідник статусів замовлень (Е1б, переписано в Е5 під незмінний `code`).
 * Сторінка лише складає частини; стан і мутації — `useOrderStatusesPage`.
 */
export default function OrderStatuses() {
  const t = useT();
  const s = useOrderStatusesPage();

  if (s.isLoading) {
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
        <Button onClick={s.openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.orders.statuses.add')}
        </Button>
      </div>

      <StatusesTable
        statuses={s.statuses}
        onReorder={s.reorder}
        onEdit={s.openEdit}
        onDelete={s.setDeleting}
      />

      <StatusFormDialog
        open={s.isDialogOpen}
        editing={s.editing}
        form={s.form}
        setForm={s.setForm}
        isSubmitting={s.isSubmitting}
        onOpenChange={s.setIsDialogOpen}
        onSubmit={s.submit}
        onClose={s.close}
      />

      <AlertDialog open={!!s.deleting} onOpenChange={() => s.setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.orders.statuses.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.orders.statuses.deleteText', {
                name: s.deleting?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => s.deleting && s.remove(s.deleting.id)}
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
