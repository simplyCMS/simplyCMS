import { resolveMediaUrl } from 'simplycms/domain/media';
import { useT } from 'simplycms/i18n';
import type { AdminCustomerCard } from 'simplycms/contracts/objects';
import { Badge } from 'simplycms/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { useFormatDate } from './useFormatDate';

/** Повне імʼя або email, коли імені немає. */
export const customerLabel = (c: AdminCustomerCard) =>
  [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;

/** Інформація про покупця: аватар (лише перегляд), email, провайдери, UTM. */
export default function CustomerInfoCard({
  card,
}: {
  readonly card: AdminCustomerCard;
}) {
  const t = useT();
  const formatDate = useFormatDate();
  // Референс сховища → URL; сам `simplycms/storage` server-only (Е2-1).
  const avatar = resolveMediaUrl(card.avatarRef);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.users.card')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-4">
          {avatar ? (
            <img
              src={avatar}
              alt={customerLabel(card)}
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl font-semibold">
              {customerLabel(card).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-medium">{card.email}</div>
            <Badge variant={card.emailVerified ? 'secondary' : 'outline'}>
              {t(
                card.emailVerified
                  ? 'admin.users.card.emailVerified'
                  : 'admin.users.card.emailUnverified',
              )}
            </Badge>
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">
            {t('admin.users.registeredLabel')}{' '}
          </span>
          {formatDate(card.createdAt)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">
            {t('admin.users.authLabel')}
          </span>
          {card.authProviders.map((p) => (
            <Badge key={p} variant="outline">
              {p}
            </Badge>
          ))}
        </div>
        {(card.utmSource || card.utmCampaign) && (
          <div>
            <div className="text-muted-foreground">{t('admin.users.utm')}</div>
            {card.utmSource && <div>source: {card.utmSource}</div>}
            {card.utmCampaign && <div>campaign: {card.utmCampaign}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
