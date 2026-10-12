import { Mail } from 'lucide-react';
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
import { useMailOutbox } from './useMailOutbox';

type Translate = ReturnType<typeof useT>;

/** Вік хвоста людською мовою: хвилини, години, доби. */
function formatAge(t: Translate, requestedAt: Date): string {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - requestedAt.getTime()) / 60_000),
  );
  if (minutes < 60)
    return t('admin.settings.mail.ageMinutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return t('admin.settings.mail.ageHours', { count: hours });
  return t('admin.settings.mail.ageDays', { count: Math.floor(hours / 24) });
}

/**
 * Блок «Пошта»: листи, які не вдалося надіслати (Е8-Р10). Показує вік, вид
 * листа й кількість спроб, але НІКОЛИ тіло — посилання скидання пароля є
 * секретом (сервер тіла не віддає). Таймера немає, тож кнопка — ручний повтор.
 */
export function MailOutboxCard() {
  const t = useT();
  const { query, retry } = useMailOutbox();
  const tails = query.data ?? [];

  const onRetry = () =>
    retry.mutate(undefined, {
      onSuccess: ({ sent, failed }) =>
        toast.success(t('admin.settings.mail.retried', { sent, failed })),
      onError: (e) => reportTxError(t, e),
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>{t('admin.settings.mail.title')}</CardTitle>
            <CardDescription>{t('admin.settings.mail.hint')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {t('admin.settings.mail.loadError')}
          </p>
        ) : (
          <p className="text-sm" data-testid="mail-outbox-count">
            {tails.length === 0
              ? t('admin.settings.mail.empty')
              : t('admin.settings.mail.count', { count: tails.length })}
          </p>
        )}
        {tails.length > 0 && (
          <ul className="space-y-2 text-sm">
            {tails.map((tail) => (
              <li key={tail.id} className="rounded-md bg-muted/50 p-3">
                <div className="font-medium">
                  {t(`admin.settings.mail.kind.${tail.kind}`)}
                </div>
                <div className="text-muted-foreground">
                  {t('admin.settings.mail.attempts', {
                    count: tail.attempts,
                    age: formatAge(t, tail.requestedAt),
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
          {t('admin.settings.mail.retry')}
        </Button>
      </CardContent>
    </Card>
  );
}
