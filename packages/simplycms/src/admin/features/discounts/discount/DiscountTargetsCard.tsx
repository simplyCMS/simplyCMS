import { useWatch } from 'react-hook-form';
import { useT, type MessageKey } from 'simplycms/i18n';
import { Badge } from 'simplycms/ui/badge';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import { X } from 'lucide-react';
import type { FormTarget } from './discount-form-schema';
import { ProductTargetDialog } from './ProductTargetDialog';
import { SectionTargetSelect } from './SectionTargetSelect';
import type { DiscountForm } from './useDiscountCard';
import { useTargetLabels } from './useTargetLabels';

const TYPE_LABEL: Record<
  Exclude<FormTarget['targetType'], 'all'>,
  MessageKey
> = {
  product: 'admin.discounts.targetProduct',
  modification: 'admin.discounts.modification',
  section: 'admin.discounts.targetSection',
};

const ALL: FormTarget[] = [{ targetType: 'all', targetId: null }];

/**
 * Цілі знижки (Е6в-7): щонайменше одна; «Всі товари» — лише єдиною, тож
 * перемикач замінює список цілком і вимикає вибір окремих цілей.
 */
export function DiscountTargetsCard({ form }: { readonly form: DiscountForm }) {
  const t = useT();
  const targets = useWatch({ control: form.control, name: 'targets' });
  const labelOf = useTargetLabels(targets);
  const error = form.formState.errors.targets;
  const isAll = targets.some((x) => x.targetType === 'all');
  const write = (next: FormTarget[]) =>
    form.setValue('targets', next, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
  const add = (target: FormTarget) => {
    if (!targets.some((x) => x.targetId === target.targetId))
      write([...targets, target]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.discounts.targets')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            id="dc-all"
            checked={isAll}
            onCheckedChange={(on) => write(on ? ALL : [])}
          />
          <Label htmlFor="dc-all">{t('admin.discounts.allProducts')}</Label>
        </div>
        {isAll ? (
          <p className="text-sm text-muted-foreground">
            {t('admin.discounts.allProductsHint')}
          </p>
        ) : (
          <>
            {targets.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('admin.discounts.noTargets')}
              </p>
            )}
            <ul className="flex flex-wrap gap-2">
              {targets.map((target) => (
                <li key={target.targetId}>
                  <Badge variant="secondary" className="gap-1">
                    {target.targetType !== 'all' &&
                      t(TYPE_LABEL[target.targetType])}
                    {': '}
                    {labelOf(target) ?? t('admin.discounts.missingTarget')}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4"
                      aria-label={t('admin.discounts.removeTarget')}
                      onClick={() => write(targets.filter((x) => x !== target))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <SectionTargetSelect onAdd={add} />
              <ProductTargetDialog onAdd={add} />
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {t('admin.discounts.targetsRequired')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
