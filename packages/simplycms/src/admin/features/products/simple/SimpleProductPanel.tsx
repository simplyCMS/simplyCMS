import { eq, useLiveQuery } from '@tanstack/react-db';
import { useFormContext } from 'react-hook-form';
import { productsCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { reportTxError } from '../../../lib/report-tx-error';
import { PricesEditor } from '../prices/PricesEditor';
import { StockEditor } from '../stock/StockEditor';
import { StockStatusSelect } from '../stock/StockStatusSelect';
import type { ProductFormValues } from '../edit/product-form-schema';

interface Props {
  readonly productId: string;
}

/**
 * Ціни/SKU/наявність ПРОСТОГО товару (Task 8, Step 4) — композиція легасі
 * `SimpleProductFields.tsx`. 🔴 МAJOR (рев'ю хвилі C): `stockStatus` —
 * ОКРЕМИЙ контрол із МИТТЄВИМ збереженням (`products.update` напряму над
 * живим рядком), а НЕ поле форми картки — інакше стейл `defaultValues`
 * RHF (без `reset`) переписав би статус, щойно виставлений `saveStock`
 * (Е3-3) або цим самим контролом, наступним Save картки.
 * `sku` лишається полем форми (Task 7, `productFormSchema`/`toProductPatch`)
 * — конфлікту стейлості нема, бо sku не змінюється поза формою.
 */
export function SimpleProductPanel({ productId }: Props) {
  const t = useT();
  const { register } = useFormContext<ProductFormValues>();
  const products = useCollection(productsCollection);
  const { data: row } = useLiveQuery(
    (q) =>
      q
        .from({ p: products })
        .where(({ p }) => eq(p.id, productId))
        .findOne(),
    [productId],
  );

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
            {row && (
              <StockStatusSelect
                value={row.stockStatus ?? 'in_stock'}
                onChange={(v) => {
                  // 🔴 Item 2: без .catch — відхилена мутація тихо
                  // відкочується (бібліотека сама) і лишає unhandled
                  // rejection у консолі.
                  const tx = products.update(productId, (d) => {
                    d.stockStatus = v;
                  });
                  tx.isPersisted.promise.catch((e: unknown) =>
                    reportTxError(t, e),
                  );
                }}
              />
            )}
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
