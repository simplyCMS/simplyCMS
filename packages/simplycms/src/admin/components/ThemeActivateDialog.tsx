import { useT } from 'simplycms/i18n';
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

interface ThemeActivateDialogProps {
  /** Назва теми для тексту підтвердження; `null` — діалог закритий. */
  themeName: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Підтвердження активації теми.
 *
 * Окремий компонент, бо зміна теми — незворотна для відвідувачів дія: вітрина
 * перемальовується одразу після мутації, тож крок підтвердження обовʼязковий.
 */
export function ThemeActivateDialog({
  themeName,
  onOpenChange,
  onConfirm,
}: ThemeActivateDialogProps) {
  const t = useT();

  return (
    <AlertDialog open={themeName !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('admin.themes.activateTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('admin.themes.activateText', { name: themeName ?? '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('common.activate')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
