import { toast } from 'sonner';
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
  AlertDialogTrigger,
} from 'simplycms/ui/alert-dialog';
import { reportTxError } from '../../lib/report-tx-error';
import type { useMediaErasures } from './useMediaErasures';

/**
 * Кнопка sweep (Е6д-22) з підтвердженням діалогом: стирання незворотне, а
 * `window.confirm` у адмінці не вживається.
 */
export function SweepMediaButton({
  sweep,
}: {
  sweep: ReturnType<typeof useMediaErasures>['sweep'];
}) {
  const t = useT();
  const run = () =>
    sweep.mutate(undefined, {
      onSuccess: ({ erased }) =>
        toast.success(t('admin.settings.storage.swept', { count: erased })),
      onError: (e) => reportTxError(t, e),
    });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" disabled={sweep.isPending}>
          {t('admin.settings.storage.sweep')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('admin.settings.storage.sweepTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('admin.settings.storage.sweepText')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={run}>
            {t('admin.settings.storage.sweep')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
