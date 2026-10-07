import type { PriceDiagnosis } from 'simplycms/admin-server';
import { useT } from 'simplycms/i18n';
import { useFormatPrice } from 'simplycms/react-query';
import { Badge } from 'simplycms/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { REJECTION_REASON_KEY } from './rejection-reasons';

interface Props {
  readonly diagnosis: PriceDiagnosis;
  /** Назви за id (колекції адмінки); невідомий id → «Не визначено». */
  readonly priceTypeName: string | null;
  readonly categoryName: string | null;
}

/** Результат діагностики: тип ціни, база, застосоване, відхилене з причиною, фінал. */
export function DiagnosisResult({
  diagnosis,
  priceTypeName,
  categoryName,
}: Props) {
  const t = useT();
  const money = useFormatPrice();
  const none = t('admin.validator.notDefined');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.validator.result')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">
            {t('admin.validator.category')}
          </dt>
          <dd>{categoryName ?? none}</dd>
          <dt className="text-muted-foreground">
            {t('admin.validator.priceType')}
          </dt>
          <dd>{priceTypeName ?? none}</dd>
        </dl>
        {!diagnosis.available || diagnosis.basePrice === null ? (
          <p role="alert" className="text-sm text-destructive">
            {t('admin.validator.unavailable')}
          </p>
        ) : (
          <p className="text-sm">
            {t('admin.validator.basePrice')}: {money(diagnosis.basePrice)}
          </p>
        )}
        <section className="space-y-1">
          <h3 className="font-medium">{t('admin.validator.applied')}</h3>
          {diagnosis.applied.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('admin.validator.noneApplied')}
            </p>
          )}
          <ul className="space-y-1 text-sm">
            {diagnosis.applied.map((a) => (
              <li key={a.id}>
                {t('admin.validator.discountLine', {
                  name: a.name,
                  group: a.groupName,
                  amount: money(a.calculatedAmount),
                })}
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-1">
          <h3 className="font-medium">{t('admin.validator.rejected')}</h3>
          {diagnosis.rejected.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('admin.validator.noneRejected')}
            </p>
          )}
          <ul className="space-y-1 text-sm">
            {diagnosis.rejected.map((r) => (
              <li key={`${r.id}:${r.reason}`} className="flex flex-wrap gap-2">
                <span>
                  {t('admin.validator.rejectedLine', {
                    name: r.name,
                    group: r.groupName,
                  })}
                </span>
                <Badge variant="outline">
                  {t(REJECTION_REASON_KEY[r.reason])}
                </Badge>
                {r.conditionType && (
                  <span className="text-muted-foreground">
                    {t('admin.validator.conditionType', {
                      type: r.conditionType,
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
        {diagnosis.finalPrice !== null && (
          <p className="text-lg font-semibold">
            {t('admin.validator.finalPrice')}: {money(diagnosis.finalPrice)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
