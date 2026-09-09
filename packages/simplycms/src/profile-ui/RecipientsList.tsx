import { useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Loader2,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { useToast } from 'simplycms/ui/use-toast';
import { useAuth } from 'simplycms/core/hooks/useAuth';
import {
  useRecipientBook,
  type RecipientRow,
} from 'simplycms/core/hooks/useRecipientBook';
import { useT } from 'simplycms/i18n';

/**
 * Книга отримувачів покупця — список і CRUD.
 *
 * 🔴 Той самий перехід, що в `AddressesList`: читання й запис під актором
 * сесії замість запитів браузера з `user_id` у предикаті. Прапорець
 * «основний» знімається з решти рядків у ТІЙ САМІЙ транзакції серверу —
 * раніше це були два незалежні запити, між якими основних було двоє.
 */
export function RecipientsList() {
  const t = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    recipients,
    isLoading,
    save: saveRecipient,
    remove: removeRecipient,
  } = useRecipientBook(!!user);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<RecipientRow | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recipientToDelete, setRecipientToDelete] =
    useState<RecipientRow | null>(null);

  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  const failed = (error: Error) =>
    toast({
      title: t('common.error'),
      description: error.message,
      variant: 'destructive',
    });

  const handleSave = () => {
    saveRecipient.mutate(
      {
        id: editingRecipient?.id ?? null,
        firstName: formFirstName,
        lastName: formLastName,
        phone: formPhone,
        email: formEmail || null,
        city: formCity,
        address: formAddress,
        notes: formNotes || null,
        isDefault: formIsDefault,
      },
      {
        onSuccess: (id) => {
          setDialogOpen(false);
          const wasEditing = editingRecipient !== null;
          setEditingRecipient(null);
          // 🔴 `null` — рядок актору не належить (RLS не віддала `returning`).
          if (!id) {
            toast({ title: t('common.error'), variant: 'destructive' });
            return;
          }
          toast({
            title: wasEditing
              ? t('common.recipient.updated')
              : t('common.recipient.added'),
          });
        },
        onError: failed,
      },
    );
  };

  const handleDelete = (id: string) => {
    removeRecipient.mutate(id, {
      onSuccess: (ok) => {
        setDeleteDialogOpen(false);
        setRecipientToDelete(null);
        toast({
          title: ok ? t('profile.recipients.deleted') : t('common.error'),
          variant: ok ? undefined : 'destructive',
        });
      },
      onError: failed,
    });
  };

  const openEditDialog = (recipient: RecipientRow) => {
    setEditingRecipient(recipient);
    setFormFirstName(recipient.first_name);
    setFormLastName(recipient.last_name);
    setFormPhone(recipient.phone);
    setFormEmail(recipient.email || '');
    setFormCity(recipient.city);
    setFormAddress(recipient.address);
    setFormNotes(recipient.notes || '');
    setFormIsDefault(recipient.is_default);
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingRecipient(null);
    setFormFirstName('');
    setFormLastName('');
    setFormPhone('');
    setFormEmail('');
    setFormCity('');
    setFormAddress('');
    setFormNotes('');
    setFormIsDefault(recipients?.length === 0);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('profile.recipients.title')}
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
            <Users className="h-5 w-5" />
            {t('profile.recipients.title')}
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
          {recipients?.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {t('profile.recipients.empty')}
            </p>
          ) : (
            <div className="grid gap-3">
              {recipients?.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="font-medium flex items-center gap-2">
                      {r.first_name} {r.last_name}
                      {r.is_default && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {t('profile.recipients.defaultBadge')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {r.phone}
                      </span>
                      {r.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {r.email}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {t('common.cityAddress', {
                        city: r.city,
                        address: r.address,
                      })}
                    </p>
                    {r.notes && (
                      <p className="text-xs text-muted-foreground italic">
                        {r.notes}
                      </p>
                    )}
                    {r.usage_count !== undefined && r.usage_count > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t(
                          r.usage_count === 1
                            ? 'profile.usedInOrders.one'
                            : 'profile.usedInOrders.many',
                          { count: r.usage_count },
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="p-2 rounded hover:bg-muted"
                      onClick={() => openEditDialog(r)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="p-2 rounded hover:bg-muted text-destructive"
                      onClick={() => {
                        setRecipientToDelete(r);
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
          <div className="relative bg-background rounded-lg shadow-lg max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingRecipient
                ? t('profile.recipients.editTitle')
                : t('common.recipient.new')}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              className="space-y-4"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {t('common.firstName')}
                  </label>
                  <input
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {t('common.lastName')}
                  </label>
                  <input
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    required
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {t('common.phone')}
                  </label>
                  <input
                    type="tel"
                    placeholder="+380..."
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {t('profile.recipients.emailOptionalLabel')}
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t('common.city')}
                </label>
                <input
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
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t('profile.recipients.notesLabel')}
                </label>
                <textarea
                  placeholder={t('profile.recipients.notesPlaceholder')}
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm resize-none"
                />
              </div>
              <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer">
                <span className="text-sm">
                  {t('profile.recipients.defaultCheckboxLabel')}
                </span>
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
                  disabled={saveRecipient.isPending}
                >
                  {saveRecipient.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingRecipient ? t('common.save') : t('common.add')}
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
              {t('profile.recipients.deleteTitle', {
                fullName:
                  `${recipientToDelete?.first_name ?? ''} ${recipientToDelete?.last_name ?? ''}`.trim(),
              })}
            </h3>
            {recipientToDelete?.usage_count &&
            recipientToDelete.usage_count > 0 ? (
              <div className="text-sm text-muted-foreground space-y-2 mb-4">
                <p>
                  {t(
                    recipientToDelete.usage_count === 1
                      ? 'profile.recipients.deleteUsedOne'
                      : 'profile.recipients.deleteUsedMany',
                    { count: recipientToDelete.usage_count },
                  )}
                </p>
                <p className="text-foreground font-medium">
                  {t('profile.recipients.deleteKeepsData')}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">
                {t('profile.recipients.deleteConfirm')}
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
                  recipientToDelete && handleDelete(recipientToDelete.id)
                }
              >
                {removeRecipient.isPending && (
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
