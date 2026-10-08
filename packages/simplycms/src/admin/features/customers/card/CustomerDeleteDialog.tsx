import { useState } from 'react';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'simplycms/ui/alert-dialog';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { useDeleteCustomer } from './useDeleteCustomer';

interface Props {
  readonly userId: string;
  readonly email: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** Видалення акаунта: кнопка активна, лише коли введено email картки. */
export default function CustomerDeleteDialog({
  userId,
  email,
  open,
  onOpenChange,
}: Props) {
  const t = useT();
  const remove = useDeleteCustomer(userId);
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  // Сервер звіряє так само (trim + нижній регістр) — клієнт лише не пускає зайвий запит.
  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  const changeOpen = (next: boolean) => {
    if (!next) {
      setTyped('');
      setFieldError(undefined);
    }
    onOpenChange(next);
  };
  const submit = async () => {
    setPending(true);
    const r = await remove(typed.trim());
    setPending(false);
    setFieldError(r.fieldError);
  };
  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('admin.users.card.deleteTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('admin.users.card.deleteWarning')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-email">
            {t('admin.users.card.deleteConfirmLabel', { email })}
          </Label>
          <Input
            id="delete-email"
            value={typed}
            aria-invalid={!!fieldError}
            onChange={(e) => {
              setTyped(e.target.value);
              setFieldError(undefined);
            }}
          />
          {fieldError && (
            <p role="alert" className="text-xs text-destructive">
              {fieldError}
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!matches || pending}
            onClick={submit}
          >
            {t('admin.users.card.deleteConfirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
