import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { useToast } from '@simplycms/ui/use-toast';
import { useAuth } from '@simplycms/core/hooks/useAuth';

interface Recipient {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  city: string;
  address: string;
  notes: string | null;
  is_default: boolean;
  usage_count?: number;
}

export function RecipientsList() {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recipientToDelete, setRecipientToDelete] = useState<Recipient | null>(
    null,
  );

  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  const { data: recipients, isLoading } = useQuery({
    queryKey: ['user-recipients', user?.id],
    queryFn: async () => {
      const { data: recipientData, error: recipientError } = await supabase
        .from('user_recipients')
        .select('*')
        .eq('user_id', user!.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (recipientError) throw recipientError;

      const recipientsWithCount = await Promise.all(
        (recipientData || []).map(async (r) => {
          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('saved_recipient_id', r.id);
          return { ...r, usage_count: count || 0 };
        }),
      );

      return recipientsWithCount as Recipient[];
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (formIsDefault) {
        await supabase
          .from('user_recipients')
          .update({ is_default: false })
          .eq('user_id', user!.id);
      }

      const payload = {
        first_name: formFirstName,
        last_name: formLastName,
        phone: formPhone,
        email: formEmail || null,
        city: formCity,
        address: formAddress,
        notes: formNotes || null,
        is_default: formIsDefault,
      };

      if (editingRecipient) {
        const { error } = await supabase
          .from('user_recipients')
          .update(payload)
          .eq('id', editingRecipient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_recipients')
          .insert([{ ...payload, user_id: user!.id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-recipients'] });
      setDialogOpen(false);
      setEditingRecipient(null);
      toast({
        title: editingRecipient ? 'Отримувача оновлено' : 'Отримувача додано',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Помилка',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_recipients')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-recipients'] });
      toast({ title: 'Отримувача видалено' });
      setDeleteDialogOpen(false);
      setRecipientToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Помилка',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const openEditDialog = (recipient: Recipient) => {
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
            Отримувачi
          </h3>
        </div>
        <div className="p-4 text-center text-muted-foreground">
          Завантаження...
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
            Отримувачi
          </h3>
          <button
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm flex items-center gap-1"
            onClick={openNewDialog}
          >
            <Plus className="h-4 w-4" />
            Додати
          </button>
        </div>
        <div className="p-4">
          {recipients?.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Ви ще не додали жодного отримувача
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
                          Основний
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
                      м. {r.city}, {r.address}
                    </p>
                    {r.notes && (
                      <p className="text-xs text-muted-foreground italic">
                        {r.notes}
                      </p>
                    )}
                    {r.usage_count !== undefined && r.usage_count > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Використано в {r.usage_count} замовленнях
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
              {editingRecipient ? 'Редагування отримувача' : 'Новий отримувач'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Iм&apos;я
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
                    Прiзвище
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
                    Телефон
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
                    Email (необов&apos;язково)
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
                <label className="text-sm font-medium mb-1 block">Мiсто</label>
                <input
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Адреса</label>
                <input
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Нотатки
                </label>
                <textarea
                  placeholder="Наприклад: Мама, колега..."
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm resize-none"
                />
              </div>
              <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer">
                <span className="text-sm">Основний отримувач</span>
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
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingRecipient ? 'Зберегти' : 'Додати'}
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
              Видалити отримувача &ldquo;{recipientToDelete?.first_name}{' '}
              {recipientToDelete?.last_name}&rdquo;?
            </h3>
            {recipientToDelete?.usage_count &&
            recipientToDelete.usage_count > 0 ? (
              <div className="text-sm text-muted-foreground space-y-2 mb-4">
                <p>
                  Цей контакт використовується в {recipientToDelete.usage_count}{' '}
                  замовленнях.
                </p>
                <p className="text-foreground font-medium">
                  Данi отримувача в замовленнях збережуться.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">
                Ви впевненi, що хочете видалити цього отримувача?
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 border rounded-md text-sm"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Скасувати
              </button>
              <button
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm flex items-center"
                onClick={() =>
                  recipientToDelete &&
                  deleteMutation.mutate(recipientToDelete.id)
                }
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Видалити
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
