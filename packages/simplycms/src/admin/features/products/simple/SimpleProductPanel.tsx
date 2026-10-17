import { useFormContext } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { PricesEditor } from '../prices/PricesEditor';
import { StockEditor } from '../stock/StockEditor';
import { StockStatusSelect } from '../stock/StockStatusSelect';
import { useProductCard } from '../edit/product-card-context';
import type { ProductFormValues } from '../edit/product-form-schema';

interface Props {
  readonly productId: string;
}

/**
 * Ціни/SKU/наявність ПРОСТОГО товару. Статус наявності — поле картки
 * (`base.stockStatus`, зберігається її кнопкою), а коли `saveStock` виводить
 * статус із залишків, форма отримує його назад (`onStatus`) — інакше наступне
 * збереження картки перезаписало б щойно виведений статус застарілим.
 */
export function SimpleProductPanel({ productId }: Props) {
  const t = useT();
  const { register, watch, setValue } = useFormContext<ProductFormValues>();
  const card = useProductCard();

  return (
    <>
      <PricesEditor productId={productId} modificationId={null} />

      <Card>
        <CardHeader>
          <CardTitle>{t('product.availability')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-sku">
                {t('admin.products.mods.sku')}
              </Label>
              <Input
                id="product-sku"
                {...register('sku')}
                placeholder="INV-001"
              />
            </div>
            <StockStatusSelect
              value={watch('stockStatus')}
              onChange={(v) =>
                setValue('stockStatus', v, { shouldDirty: true })
              }
            />
          </div>

          <StockEditor
            productId={productId}
            modificationId={null}
            showCard={false}
            onStatus={(status) => card.onStockStatus(null, status)}
          />
        </CardContent>
      </Card>
    </>
  );
}
