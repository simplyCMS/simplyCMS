import { useState } from 'react';
import { useFormatPrice } from 'simplycms/react-query';
import { useT } from 'simplycms/i18n';
import type { AdminCustomerCard } from 'simplycms/contracts/objects';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';

const DAY_MS = 86_400_000;

/** Статистика покупок; без профілю (власник від CLI) — «—», не нулі. */
export default function CustomerStatsCard({
  card,
}: {
  readonly card: AdminCustomerCard;
}) {
  const t = useT();
  const formatPrice = useFormatPrice();
  // Момент рендера фіксуємо один раз: чиста функція від пропсів і стану.
  const [now] = useState(() => Date.now());
  const days = Math.floor((now - card.createdAt.getTime()) / DAY_MS);
  const rows: Array<[string, string]> = [
    [
      t('admin.users.ordersCount'),
      card.stats ? String(card.stats.ordersCount) : '—',
    ],
    [
      t('admin.users.totalSpent'),
      card.stats ? formatPrice(card.stats.totalPurchasesCents / 100) : '—',
    ],
    [t('admin.users.daysSince'), String(days)],
    [t('admin.users.emailDomain'), card.email.split('@')[1] ?? '—'],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.users.stats')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
