import { useFormContext } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { PricesEditor } from '../prices/PricesEditor';
import { StockEditor } from '../stock/StockEditor';
import { StockStatusSelect } from '../stock/StockStatusSelect';
import type { ProductFormValues } from '../edit/product-form-schema';

interface Props {
  readonly productId: string;
}

/**
 * Ціни/SKU/наявність ПРОСТОГО товару (Task 8, Step 4) — композиція легасі
 * `SimpleProductFields.tsx`. 🔴 На відміну від плану (там — контрольовані
 * пропси `sku`/`onSkuChange`), тут — `useFormContext` (як `ProductMainFields`/
 * `ProductSidebar`, Task 7): поля `sku`/`stockStatus` УЖЕ в
 * `productFormSchema`/`toProductPatch` (Task 7, `useProductSave.test.tsx`
 * кейс (в)) і йдуть в БД ОДНИМ `updateProducts` разом з рештою картки —
 * контрольовані пропси зовні RHF дали б ДВА джерела правди для тих самих
 * полів і гонку зі стейл `defaultValues` на наступному Save.
 */
export function SimpleProductPanel({ productId }: Props) {
  const t = useT();
  const { register, watch, setValue } = useFormContext<ProductFormValues>();

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
          />
        </CardContent>
      </Card>
    </>
  );
}
