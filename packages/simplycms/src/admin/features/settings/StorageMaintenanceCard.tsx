import { HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'simplycms/ui/card';
import { reportTxError } from '../../lib/report-tx-error';
import { useFormatDate } from '../customers/card/useFormatDate';
import { useMediaErasures } from './useMediaErasures';

/**
 * Блок «Сховище файлів»: хвости стирання (Е6д-20) — файли, які не вдалося
 * видалити після COMMIT. Фонового шедулера немає, тож кнопка — ручний повтор.
 */
export function StorageMaintenanceCard() {
  const t = useT();
  const formatDate = useFormatDate('short');
  const { query, retry } = useMediaErasures();
  const tails = query.data ?? [];

  const onRetry = () =>
    retry.mutate(undefined, {
      onSuccess: ({ done, failed }) =>
        toast.success(t('admin.settings.storage.retried', { done, failed })),
      onError: (e) => reportTxError(t, e),
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <HardDrive className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>{t('admin.settings.storage.title')}</CardTitle>
            <CardDescription>
              {t('admin.settings.storage.hint')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {t('admin.settings.storage.loadError')}
          </p>
        ) : (
          <p className="text-sm" data-testid="erasure-count">
            {t('admin.settings.storage.count', { count: tails.length })}
          </p>
        )}
        {tails.length > 0 && (
          <ul className="space-y-2 text-sm">
            {tails.map((tail) => (
              <li key={tail.storageKey} className="rounded-md bg-muted/50 p-3">
                <div className="font-mono break-all">{tail.storageKey}</div>
                <div className="text-muted-foreground">
                  {t('admin.settings.storage.attempts', {
                    count: tail.attempts,
                    date: formatDate(tail.requestedAt),
                  })}
                  {tail.lastError ? ` — ${tail.lastError}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={tails.length === 0 || retry.isPending}
          onClick={onRetry}
        >
          {t('admin.settings.storage.retry')}
        </Button>
      </CardContent>
    </Card>
  );
}
