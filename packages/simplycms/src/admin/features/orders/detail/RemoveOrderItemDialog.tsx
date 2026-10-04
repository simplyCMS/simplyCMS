import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
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

interface Props {
  readonly name: string;
  readonly onConfirm: () => Promise<boolean>;
}

/** Видалення позиції: кнопка + `AlertDialog`; виклик — лише після підтвердження. */
export function RemoveOrderItemDialog({ name, onConfirm }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // Поки видалення летить, повторне підтвердження другого запиту не шле.
  const inFlight = useRef(false);
  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await onConfirm();
    } finally {
      inFlight.current = false;
    }
  };
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`${t('common.delete')}: ${name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.orders.removeItemTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.orders.removeItemText', { name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOpen(false);
                void confirm();
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
