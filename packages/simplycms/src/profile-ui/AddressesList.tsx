import { useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from 'simplycms/ui/use-toast';
import { useAuth } from 'simplycms/core/hooks/useAuth';
import {
  useAddressBook,
  type AddressRow,
} from 'simplycms/core/hooks/useAddressBook';
import { useT } from 'simplycms/i18n';

/**
 * Адреси доставки покупця — список і CRUD.
 *
 * 🔴 Читання і запис ідуть серверними викликами під актором покупця. Раніше
 * браузер робив це напряму: список із `eq('user_id', …)` плюс окремий `count`
 * на КОЖЕН рядок, а видалення — `delete().eq('id', …)` взагалі без згадки про
 * власника. Належність рядка тепер доводить сесія, а не параметр запиту.
 */
export function AddressesList() {
  const t = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    addresses,
    isLoading,
    save: saveAddress,
    remove: removeAddress,
  } = useAddressBook(!!user);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AddressRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<AddressRow | null>(
    null,
  );

  const [formName, setFormName] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  const failed = (error: Error) =>
    toast({
      title: t('common.error'),
      description: error.message,
      variant: 'destructive',
    });

  const handleSave = () => {
    saveAddress.mutate(
      {
        id: editingAddress?.id ?? null,
        name: formName,
        city: formCity,
        address: formAddress,
        isDefault: formIsDefault,
      },
      {
        onSuccess: (id) => {
          setDialogOpen(false);
          const wasEditing = editingAddress !== null;
          setEditingAddress(null);
          // 🔴 `null` — рядок актору не належить (RLS не віддала `returning`).
          if (!id) {
            toast({ title: t('common.error'), variant: 'destructive' });
            return;
          }
          toast({
            title: wasEditing
              ? t('common.address.updated')
              : t('common.address.added'),
          });
        },
        onError: failed,
      },
    );
  };

  const handleDelete = (id: string) => {
    removeAddress.mutate(id, {
      onSuccess: (ok) => {
        setDeleteDialogOpen(false);
        setAddressToDelete(null);
        toast({
          title: ok ? t('profile.addresses.deleted') : t('common.error'),
          variant: ok ? undefined : 'destructive',
        });
      },
      onError: failed,
    });
  };

  const openEditDialog = (address: AddressRow) => {
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
                handleSave();
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
                  disabled={saveAddress.isPending}
                >
                  {saveAddress.isPending && (
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
                  addressToDelete && handleDelete(addressToDelete.id)
                }
              >
                {removeAddress.isPending && (
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
