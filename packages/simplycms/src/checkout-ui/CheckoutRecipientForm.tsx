import { useEffect, useState, useMemo, useCallback } from 'react';
import { UserPlus, ChevronRight, Save } from 'lucide-react';
import { useAuth } from 'simplycms/core/hooks/useAuth';
import {
  useRecipientBook,
  type RecipientRow,
} from 'simplycms/core/hooks/useRecipientBook';
import { useToast } from 'simplycms/ui/use-toast';
import { useT } from 'simplycms/i18n';
import { RecipientCard } from './RecipientCard';
import { RecipientSelectorPopup } from './RecipientSelectorPopup';
import { RecipientSaveDialog } from './RecipientSaveDialog';

interface CheckoutRecipientFormProps {
  values: Record<string, string | boolean>;
  onChange: (field: string, value: string | boolean) => void;
}

const MAX_VISIBLE_CARDS = 3;

/**
 * Отримувач замовлення й книга збережених отримувачів.
 *
 * 🔴 Книга читається серверним викликом під актором покупця, а не запитом
 * браузера з `user_id` у предикаті: підставлений чужий id більше не існує як
 * параметр — ідентичність бере сесія (`readSessionSubject`).
 */
export function CheckoutRecipientForm({
  values,
  onChange,
}: CheckoutRecipientFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const hasDifferentRecipient = values.hasDifferentRecipient;
  const selectedRecipientId = values.savedRecipientId as string | undefined;

  const [popupOpen, setPopupOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [originalRecipient, setOriginalRecipient] =
    useState<RecipientRow | null>(null);

  const { recipients: savedRecipients, save: saveRecipient } =
    useRecipientBook(!!user);

  const visibleRecipients = useMemo(
    () => (savedRecipients ?? []).slice(0, MAX_VISIBLE_CARDS),
    [savedRecipients],
  );

  const showMoreButton =
    savedRecipients && savedRecipients.length > MAX_VISIBLE_CARDS;

  const currentValues = useMemo(
    () => ({
      firstName: String(values.recipientFirstName || ''),
      lastName: String(values.recipientLastName || ''),
      phone: String(values.recipientPhone || ''),
      email: String(values.recipientEmail || ''),
      city: String(values.recipientCity || ''),
      address: String(values.recipientAddress || ''),
      notes: String(values.recipientNotes || ''),
    }),
    [
      values.recipientFirstName,
      values.recipientLastName,
      values.recipientPhone,
      values.recipientEmail,
      values.recipientCity,
      values.recipientAddress,
      values.recipientNotes,
    ],
  );

  // hasChanges — виведений стан, не потребує окремого useState
  const hasChanges = useMemo(() => {
    if (!originalRecipient) return false;
    return (
      currentValues.firstName !== originalRecipient.first_name ||
      currentValues.lastName !== originalRecipient.last_name ||
      currentValues.phone !== originalRecipient.phone ||
      (currentValues.email || '') !== (originalRecipient.email || '') ||
      currentValues.city !== originalRecipient.city ||
      currentValues.address !== originalRecipient.address ||
      (currentValues.notes || '') !== (originalRecipient.notes || '')
    );
  }, [currentValues, originalRecipient]);

  const handleSelectRecipient = (recipientId: string) => {
    if (selectedRecipientId === recipientId) {
      onChange('savedRecipientId', '');
      setOriginalRecipient(null);
      clearRecipientFields();
      return;
    }
    const recipient = savedRecipients?.find((r) => r.id === recipientId);
    if (recipient) {
      onChange('savedRecipientId', recipientId);
      setOriginalRecipient(recipient);
      fillRecipientFields(recipient);
    }
  };

  const fillRecipientFields = (recipient: RecipientRow) => {
    onChange('recipientFirstName', recipient.first_name);
    onChange('recipientLastName', recipient.last_name);
    onChange('recipientPhone', recipient.phone);
    onChange('recipientEmail', recipient.email || '');
    onChange('recipientCity', recipient.city);
    onChange('recipientAddress', recipient.address);
    onChange('recipientNotes', recipient.notes || '');
  };

  const clearRecipientFields = useCallback(() => {
    [
      'recipientFirstName',
      'recipientLastName',
      'recipientPhone',
      'recipientEmail',
      'recipientCity',
      'recipientAddress',
      'recipientNotes',
    ].forEach((f) => onChange(f, ''));
  }, [onChange]);

  /** Поля форми → вхід serverFn (порожній рядок означає «немає значення»). */
  const toInput = (isDefault: boolean) => ({
    firstName: currentValues.firstName,
    lastName: currentValues.lastName,
    phone: currentValues.phone,
    email: currentValues.email || null,
    city: currentValues.city,
    address: currentValues.address,
    notes: currentValues.notes || null,
    isDefault,
  });

  /**
   * 🔴 `null` у відповіді — рядок актору не належить: RLS не віддала його
   * `returning`. Показати «оновлено» в цьому разі означало б збрехати.
   */
  const handleUpdateRecipient = () => {
    if (!originalRecipient) return;
    saveRecipient.mutate(
      { id: originalRecipient.id, ...toInput(originalRecipient.is_default) },
      {
        onSuccess: (id) => {
          if (!id) {
            toast({ title: t('common.error'), variant: 'destructive' });
            return;
          }
          toast({ title: t('common.recipient.updated') });
        },
      },
    );
  };

  const handleCreateRecipient = () => {
    if (!user) return;
    saveRecipient.mutate(toInput(false), {
      onSuccess: (id) => {
        if (!id) return;
        toast({ title: t('checkout.recipientForm.created') });
        onChange('savedRecipientId', id);
        setOriginalRecipient({
          id,
          first_name: currentValues.firstName,
          last_name: currentValues.lastName,
          phone: currentValues.phone,
          email: currentValues.email || null,
          city: currentValues.city,
          address: currentValues.address,
          notes: currentValues.notes || null,
          is_default: false,
          usage_count: 0,
        });
      },
    });
  };

  const handleSaveClick = () => {
    if (originalRecipient) setSaveDialogOpen(true);
    else if (user) handleCreateRecipient();
  };

  const handleCancelChanges = () => {
    if (originalRecipient) fillRecipientFields(originalRecipient);
    else clearRecipientFields();
  };

  const handleAddNew = () => {
    onChange('savedRecipientId', '');
    setOriginalRecipient(null);
    clearRecipientFields();
    setPopupOpen(false);
  };

  // Скидання отримувача при вимкненні опції (adjust state during render)
  const [prevHasDifferentRecipient, setPrevHasDifferentRecipient] = useState(
    hasDifferentRecipient,
  );
  if (hasDifferentRecipient !== prevHasDifferentRecipient) {
    setPrevHasDifferentRecipient(hasDifferentRecipient);
    if (!hasDifferentRecipient) {
      setOriginalRecipient(null);
    }
  }

  useEffect(() => {
    if (!hasDifferentRecipient) {
      onChange('savedRecipientId', '');
      clearRecipientFields();
    }
  }, [hasDifferentRecipient, onChange, clearRecipientFields]);

  return (
    <>
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t('checkout.success.recipient')}
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!hasDifferentRecipient}
              onChange={(e) =>
                onChange('hasDifferentRecipient', e.target.checked)
              }
              className="rounded mt-0.5"
            />
            <div>
              <span className="font-medium text-sm">
                {t('checkout.recipientForm.differentRecipient')}
              </span>
              <p className="text-sm text-muted-foreground">
                {t('checkout.recipientForm.differentRecipientHint')}
              </p>
            </div>
          </label>

          {hasDifferentRecipient && (
            <div className="space-y-4 pt-4 border-t">
              {user && savedRecipients && savedRecipients.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('checkout.recipientForm.savedRecipients')}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {visibleRecipients.map((recipient) => (
                      <RecipientCard
                        key={recipient.id}
                        id={recipient.id}
                        firstName={recipient.first_name}
                        lastName={recipient.last_name}
                        phone={recipient.phone}
                        city={recipient.city}
                        isSelected={selectedRecipientId === recipient.id}
                        isDefault={recipient.is_default}
                        onClick={() => handleSelectRecipient(recipient.id)}
                      />
                    ))}
                  </div>
                  {showMoreButton && (
                    <button
                      type="button"
                      className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
                      onClick={() => setPopupOpen(true)}
                    >
                      {t('checkout.recipientForm.showAll', {
                        count: savedRecipients.length,
                      })}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {t('checkout.recipientForm.firstNameLabel')}
                  </label>
                  <input
                    placeholder={t('profile.settings.firstNamePlaceholder')}
                    value={currentValues.firstName || ''}
                    onChange={(e) =>
                      onChange('recipientFirstName', e.target.value)
                    }
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {t('checkout.recipientForm.lastNameLabel')}
                  </label>
                  <input
                    placeholder={t('profile.settings.lastNamePlaceholder')}
                    value={currentValues.lastName || ''}
                    onChange={(e) =>
                      onChange('recipientLastName', e.target.value)
                    }
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {t('checkout.recipientForm.phoneLabel')}
                  </label>
                  <input
                    type="tel"
                    placeholder="+380"
                    value={currentValues.phone || ''}
                    onChange={(e) => onChange('recipientPhone', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {t('checkout.recipientForm.emailLabel')}
                  </label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={currentValues.email || ''}
                    onChange={(e) => onChange('recipientEmail', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {t('checkout.cityLabel')}
                  </label>
                  <input
                    placeholder={t('checkout.cityPlaceholder')}
                    value={currentValues.city || ''}
                    onChange={(e) => onChange('recipientCity', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {t('checkout.recipientForm.addressLabel')}
                  </label>
                  <input
                    placeholder={t('checkout.streetAddressPlaceholder')}
                    value={currentValues.address || ''}
                    onChange={(e) =>
                      onChange('recipientAddress', e.target.value)
                    }
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t('checkout.recipientForm.notesLabel')}
                </label>
                <textarea
                  placeholder={t('checkout.recipientForm.notesPlaceholder')}
                  value={currentValues.notes || ''}
                  onChange={(e) => onChange('recipientNotes', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm resize-none"
                />
              </div>

              {user && hasChanges && (
                <div className="flex gap-2 p-3 bg-muted/50 rounded-lg">
                  <button
                    type="button"
                    className="px-3 py-1.5 border rounded-md text-sm"
                    onClick={handleCancelChanges}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm flex items-center gap-2"
                    onClick={handleSaveClick}
                    disabled={saveRecipient.isPending}
                  >
                    <Save className="h-4 w-4" />
                    {t('checkout.recipientForm.saveChanges')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {savedRecipients && (
        <RecipientSelectorPopup
          open={popupOpen}
          onOpenChange={setPopupOpen}
          recipients={savedRecipients}
          selectedId={selectedRecipientId ?? null}
          onSelect={handleSelectRecipient}
          onAddNew={handleAddNew}
        />
      )}

      <RecipientSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        existingRecipientName={
          originalRecipient
            ? `${originalRecipient.first_name} ${originalRecipient.last_name}`
            : undefined
        }
        onUpdate={handleUpdateRecipient}
        onCreate={() => {
          onChange('savedRecipientId', '');
          handleCreateRecipient();
        }}
        onCancel={handleCancelChanges}
      />
    </>
  );
}
