import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useToast } from 'simplycms/ui/use-toast';
import { useAuth } from 'simplycms/core/hooks/useAuth';
import { useT } from 'simplycms/i18n';

interface Address {
  id: string;
  name: string;
  city: string;
  address: string;
  is_default: boolean;
  usage_count?: number;
}

export function AddressesList() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);

  const [formName, setFormName] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['user-addresses', user?.id],
    queryFn: async () => {
      const { data: addressData, error: addressError } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user!.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (addressError) throw addressError;

      const addressesWithCount = await Promise.all(
        (addressData || []).map(async (addr) => {
          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('saved_address_id', addr.id);
          return { ...addr, usage_count: count || 0 };
        }),
      );

      return addressesWithCount as Address[];
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (formIsDefault) {
        await supabase
          .from('user_addresses')
          .update({ is_default: false })
          .eq('user_id', user!.id);
      }

      const data = {
        name: formName,
        city: formCity,
        address: formAddress,
        is_default: formIsDefault,
      };

      if (editingAddress) {
        const { error } = await supabase
          .from('user_addresses')
          .update(data)
          .eq('id', editingAddress.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_addresses')
          .insert([{ ...data, user_id: user!.id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-addresses'] });
      setDialogOpen(false);
      setEditingAddress(null);
      toast({
        title: editingAddress
          ? t('common.address.updated')
          : t('common.address.added'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_addresses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-addresses'] });
      toast({ title: t('profile.addresses.deleted') });
      setDeleteDialogOpen(false);
      setAddressToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const openEditDialog = (address: Address) => {
    setEditingAddress(address);
    setFormName(address.name);
    setFormCity(address.city);
    setFormAddress(address.address);
    setFormIsDefault(address.is_default);
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingAddress(null);
    setFormName('');
    setFormCity('');
    setFormAddress('');
    setFormIsDefault(addresses?.length === 0);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t('profile.addresses.title')}
          </h3>
        </div>
        <div className="p-4 text-center text-muted-foreground">
          {t('common.loading')}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t('profile.addresses.title')}
          </h3>
          <button
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm flex items-center gap-1"
            onClick={openNewDialog}
          >
            <Plus className="h-4 w-4" />
            {t('common.add')}
          </button>
        </div>
        <div className="p-4">
          {addresses?.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {t('profile.addresses.empty')}
            </p>
          ) : (
            <div className="space-y-3">
              {addresses?.map((addr) => (
                <div
                  key={addr.id}
                  className="flex items-start justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {addr.name}
                      {addr.is_default && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {t('common.byDefault')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('common.cityAddress', {
                        city: addr.city,
                        address: addr.address,
                      })}
                    </p>
                    {addr.usage_count !== undefined && addr.usage_count > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t(
                          addr.usage_count === 1
                            ? 'profile.usedInOrders.one'
                            : 'profile.usedInOrders.many',
                          { count: addr.usage_count },
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="p-2 rounded hover:bg-muted"
                      onClick={() => openEditDialog(addr)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="p-2 rounded hover:bg-muted text-destructive"
                      onClick={() => {
                        setAddressToDelete(addr);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setDialogOpen(false)}
          />
          <div className="relative bg-background rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingAddress
                ? t('profile.addresses.editTitle')
                : t('common.address.new')}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t('common.name')}
                </label>
                <input
                  placeholder={t('profile.addresses.namePlaceholder')}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t('common.city')}
                </label>
                <input
                  placeholder={t('profile.addresses.cityPlaceholder')}
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t('common.address')}
                </label>
                <input
                  placeholder={t('profile.addresses.addressPlaceholder')}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  required
                />
              </div>
              <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer">
                <span className="text-sm">{t('common.byDefault')}</span>
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 border rounded-md text-sm"
                  onClick={() => setDialogOpen(false)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingAddress ? t('common.save') : t('common.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setDeleteDialogOpen(false)}
          />
          <div className="relative bg-background rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('profile.addresses.deleteTitle', {
                name: addressToDelete?.name ?? '',
              })}
            </h3>
            {addressToDelete?.usage_count && addressToDelete.usage_count > 0 ? (
              <div className="text-sm text-muted-foreground space-y-2 mb-4">
                <p>
                  {t(
                    addressToDelete.usage_count === 1
                      ? 'profile.addresses.deleteUsedOne'
                      : 'profile.addresses.deleteUsedMany',
                    { count: addressToDelete.usage_count },
                  )}
                </p>
                <p className="text-foreground font-medium">
                  {t('profile.addresses.deleteKeepsData')}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">
                {t('profile.addresses.deleteConfirm')}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 border rounded-md text-sm"
                onClick={() => setDeleteDialogOpen(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm flex items-center"
                onClick={() =>
                  addressToDelete && deleteMutation.mutate(addressToDelete.id)
                }
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
