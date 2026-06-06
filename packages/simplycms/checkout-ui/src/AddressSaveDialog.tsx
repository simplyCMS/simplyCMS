
import { MapPin, RefreshCw, X } from "lucide-react";

interface AddressSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingAddressName?: string;
  onUpdate: () => void;
  onCreate: () => void;
  onCancel: () => void;
}

export function AddressSaveDialog({
  open,
  onOpenChange,
  existingAddressName,
  onUpdate,
  onCreate,
  onCancel,
}: AddressSaveDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative bg-background rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold mb-2">Зберегти адресу?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Ви змiнили адресу доставки. Оберiть дiю:
        </p>

        <div className="flex flex-col gap-2 my-4">
          {existingAddressName && (
            <button
              className="flex items-start gap-3 p-3 border rounded-lg text-left hover:bg-accent"
              onClick={() => {
                onUpdate();
                onOpenChange(false);
              }}
            >
              <RefreshCw className="h-4 w-4 mt-0.5 text-primary" />
              <div>
                <div className="font-medium">Оновити &ldquo;{existingAddressName}&rdquo;</div>
                <div className="text-xs text-muted-foreground">
                  Зберегти змiни в iснуючiй адресi
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
            <MapPin className="h-4 w-4 mt-0.5 text-primary" />
            <div>
              <div className="font-medium">Створити нову адресу</div>
              <div className="text-xs text-muted-foreground">
                Зберегти як нову адресу в довiднику
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
            Скасувати змiни
          </button>
        </div>
      </div>
    </div>
  );
}
