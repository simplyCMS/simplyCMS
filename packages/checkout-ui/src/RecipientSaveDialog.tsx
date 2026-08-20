import { useT } from 'simplycms/i18n';
import { UserPlus, RefreshCw, X } from 'lucide-react';

interface RecipientSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRecipientName?: string;
  onUpdate: () => void;
  onCreate: () => void;
  onCancel: () => void;
}

export function RecipientSaveDialog({
  open,
  onOpenChange,
  existingRecipientName,
  onUpdate,
  onCreate,
  onCancel,
}: RecipientSaveDialogProps) {
  const t = useT();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative bg-background rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold mb-2">
          {t('checkout.recipientSaveDialog.title')}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('checkout.recipientSaveDialog.description')}
        </p>

        <div className="flex flex-col gap-2 my-4">
          {existingRecipientName && (
            <button
              className="flex items-start gap-3 p-3 border rounded-lg text-left hover:bg-accent"
              onClick={() => {
                onUpdate();
                onOpenChange(false);
              }}
            >
              <RefreshCw className="h-4 w-4 mt-0.5 text-primary" />
              <div>
                <div className="font-medium">
                  {t('checkout.saveDialog.updateTitle', {
                    name: existingRecipientName,
                  })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('checkout.recipientSaveDialog.updateDescription')}
                </div>
              </div>
            </button>
          )}

          <button
            className="flex items-start gap-3 p-3 border rounded-lg text-left hover:bg-accent"
            onClick={() => {
              onCreate();
              onOpenChange(false);
            }}
          >
            <UserPlus className="h-4 w-4 mt-0.5 text-primary" />
            <div>
              <div className="font-medium">
                {t('checkout.recipientSaveDialog.createTitle')}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('checkout.recipientSaveDialog.createDescription')}
              </div>
            </div>
          </button>
        </div>

        <div className="flex justify-end">
          <button
            className="flex items-center gap-2 px-4 py-2 border rounded-md text-sm"
            onClick={() => {
              onCancel();
              onOpenChange(false);
            }}
          >
            <X className="h-4 w-4" />
            {t('checkout.saveDialog.cancelChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}
