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

interface Props {
  readonly open: boolean;
  readonly onReload: () => void;
  readonly onKeep: () => void;
}

/**
 * Діалог 412: товар змінив хтось інший. Введене НЕ скидається мовчки —
 * «Перезавантажити» — свідомий вибір користувача, «Лишити мої зміни» закриває
 * діалог (наступний «Зберегти» знову дасть 412, доки не перезавантажити).
 */
export function ConflictDialog({ open, onReload, onKeep }: Props) {
  const t = useT();
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onKeep()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('admin.translations.conflict.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('admin.translations.conflict.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('admin.translations.conflict.keep')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onReload}>
            {t('admin.translations.conflict.reload')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
