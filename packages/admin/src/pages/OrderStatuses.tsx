import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { useT } from '@simplycms/i18n';
import { Button } from '@simplycms/ui/button';
import { Input } from '@simplycms/ui/input';
import { Label } from '@simplycms/ui/label';
import { Switch } from '@simplycms/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@simplycms/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@simplycms/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@simplycms/ui/alert-dialog';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

interface OrderStatus {
  id: string;
  name: string;
  code: string;
  color: string | null;
  sort_order: number;
  is_default: boolean;
  created_at: string;
}

interface StatusFormData {
  name: string;
  code: string;
  color: string;
  is_default: boolean;
}

export default function OrderStatuses() {
  const t = useT();
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<OrderStatus | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<OrderStatus | null>(null);
  const [formData, setFormData] = useState<StatusFormData>({
    name: '',
    code: '',
    color: '#6B7280',
    is_default: false,
  });

  const { data: statuses, isLoading } = useQuery({
    queryKey: ['order-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_statuses')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as OrderStatus[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: StatusFormData) => {
      const maxSortOrder =
        statuses?.reduce((max, s) => Math.max(max, s.sort_order), -1) ?? -1;

      // If setting as default, unset other defaults first
      if (data.is_default) {
        await supabase
          .from('order_statuses')
          .update({ is_default: false })
          .eq('is_default', true);
      }

      const { error } = await supabase.from('order_statuses').insert({
        name: data.name,
        code: data.code,
        color: data.color,
        is_default: data.is_default,
        sort_order: maxSortOrder + 1,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-statuses'] });
      toast.success(t('admin.orders.statuses.created'));
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(
        t('admin.orders.statuses.createFailed') + ' ' + error.message,
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: StatusFormData }) => {
      // If setting as default, unset other defaults first
      if (data.is_default) {
        await supabase
          .from('order_statuses')
          .update({ is_default: false })
          .neq('id', id);
      }

      const { error } = await supabase
        .from('order_statuses')
        .update({
          name: data.name,
          code: data.code,
          color: data.color,
          is_default: data.is_default,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-statuses'] });
      toast.success(t('common.statusUpdated'));
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(
        t('admin.orders.statuses.updateFailed') + ' ' + error.message,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('order_statuses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-statuses'] });
      toast.success(t('admin.orders.statuses.deleted'));
      setDeleteStatus(null);
    },
    onError: (error) => {
      toast.error(
        t('admin.orders.statuses.deleteFailed') + ' ' + error.message,
      );
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({
      id,
      direction,
    }: {
      id: string;
      direction: 'up' | 'down';
    }) => {
      if (!statuses) return;

      const currentIndex = statuses.findIndex((s) => s.id === id);
      if (currentIndex === -1) return;

      const swapIndex =
        direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (swapIndex < 0 || swapIndex >= statuses.length) return;

      const currentStatus = statuses[currentIndex];
      const swapStatus = statuses[swapIndex];

      // Swap sort_order values
      await supabase
        .from('order_statuses')
        .update({ sort_order: swapStatus.sort_order })
        .eq('id', currentStatus.id);

      await supabase
        .from('order_statuses')
        .update({ sort_order: currentStatus.sort_order })
        .eq('id', swapStatus.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-statuses'] });
    },
    onError: (error) => {
      toast.error(
        t('admin.orders.statuses.reorderFailed') + ' ' + error.message,
      );
    },
  });

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
      is_default: status.is_default,
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
      updateMutation.mutate({ id: editingStatus.id, data: formData });
    } else {
      createMutation.mutate(formData);
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
            {statuses?.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  {t('admin.orders.statuses.empty')}
                </TableCell>
              </TableRow>
            ) : (
              statuses?.map((status, index) => (
                <TableRow key={status.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === 0}
                        onClick={() =>
                          reorderMutation.mutate({
                            id: status.id,
                            direction: 'up',
                          })
                        }
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === (statuses?.length ?? 0) - 1}
                        onClick={() =>
                          reorderMutation.mutate({
                            id: status.id,
                            direction: 'down',
                          })
                        }
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
                    {status.is_default && (
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
                        disabled={status.is_default}
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
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
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
              onClick={() =>
                deleteStatus && deleteMutation.mutate(deleteStatus.id)
              }
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
