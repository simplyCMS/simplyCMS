import { Input } from '@simplycms/ui/input';
import { Label } from '@simplycms/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import { StockStatusSelect } from './StockStatusSelect';
import { useT } from '@simplycms/i18n';
import { StockByPointManager } from './StockByPointManager';
import { ProductPricesEditor } from './ProductPricesEditor';
import type { StockStatus } from '@simplycms/core/hooks/useStock';

interface SimpleProductFieldsProps {
  productId: string;
  sku: string;
  stockStatus: StockStatus;
  onSkuChange: (value: string) => void;
  onStockStatusChange: (value: StockStatus) => void;
}

export function SimpleProductFields({
  productId,
  sku,
  stockStatus,
  onSkuChange,
  onStockStatusChange,
}: SimpleProductFieldsProps) {
  const t = useT();

  return (
    <>
      <ProductPricesEditor productId={productId} />

      <Card>
        <CardHeader>
          <CardTitle>{t('product.availability')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">{t('admin.products.mods.sku')}</Label>
              <Input
                id="sku"
                value={sku}
                onChange={(e) => onSkuChange(e.target.value)}
                placeholder="INV-001"
              />
            </div>
            <StockStatusSelect
              value={stockStatus}
              onChange={onStockStatusChange}
            />
          </div>

          <StockByPointManager productId={productId} showCard={false} />
        </CardContent>
      </Card>
    </>
  );
}
