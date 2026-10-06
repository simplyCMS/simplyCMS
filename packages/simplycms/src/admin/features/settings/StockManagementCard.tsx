import { Package } from 'lucide-react';
import { useT } from 'simplycms/i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'simplycms/ui/card';
import { Label } from 'simplycms/ui/label';
import { Separator } from 'simplycms/ui/separator';
import { Switch } from 'simplycms/ui/switch';

type Props = {
  readonly decreaseOnOrder: boolean;
  readonly pending: boolean;
  /** Перемикач зберігається одразу (Е6б-21), не кнопкою форми профілю. */
  readonly onToggle: (next: boolean) => void;
};

/** Блок «Управління залишками». */
export function StockManagementCard({
  decreaseOnOrder,
  pending,
  onToggle,
}: Props) {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>{t('admin.settings.stock')}</CardTitle>
            <CardDescription>{t('admin.settings.stockHint')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="decrease_on_order" className="text-base">
              {t('admin.settings.decreaseStock')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('admin.settings.decreaseStockHint')}
            </p>
          </div>
          <Switch
            id="decrease_on_order"
            checked={decreaseOnOrder}
            onCheckedChange={onToggle}
            disabled={pending}
          />
        </div>
        <Separator />
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium mb-2">{t('common.howItWorks')}</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>{t('admin.settings.enabledCase')}</li>
            <li>{t('admin.settings.disabledCase')}</li>
            <li>{t('admin.settings.warehouseNote')}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
