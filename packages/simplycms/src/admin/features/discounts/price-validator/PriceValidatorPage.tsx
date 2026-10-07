import { useRef, useState } from 'react';
import { diagnosePrice, type PriceDiagnosis } from 'simplycms/admin-server';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { CustomerPicker, type PickedCustomer } from './CustomerPicker';
import { DiagnosisResult } from './DiagnosisResult';
import { ProductPicker, type PickedProduct } from './ProductPicker';
import { useCatalogNames } from './useCatalogNames';

const MAX_QUANTITY = 999;

/**
 * Валідатор цін (З-4): те саме ядро, що й чекаут, але з поясненням кожної
 * знижки. Сервер — `diagnosePrice` (`discount.manage`); тут лише форма.
 */
export default function PriceValidatorPage() {
  const t = useT();
  const names = useCatalogNames();
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [cartTotal, setCartTotal] = useState('0');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<PriceDiagnosis | null>(null);
  const inFlight = useRef(false);

  const qty = Number(quantity);
  const total = Number(cartTotal);
  const ready =
    product !== null &&
    (!product.hit.hasModifications || product.modificationId !== null) &&
    Number.isInteger(qty) &&
    qty >= 1 &&
    qty <= MAX_QUANTITY &&
    cartTotal.trim() !== '' &&
    Number.isFinite(total) &&
    total >= 0;

  const run = async () => {
    if (!product || !ready || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    try {
      // cache-sync-ok: діагностика лише читає — кеш синкати нічого
      setResult(
        await diagnosePrice({
          data: {
            userId: customer?.userId ?? null,
            productId: product.hit.productId,
            modificationId: product.hit.hasModifications
              ? product.modificationId
              : null,
            quantity: qty,
            otherCartTotal: total,
          },
        }),
      );
    } catch {
      setResult(null);
      setFailed(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.nav.priceValidator')}</h1>
        <p className="text-muted-foreground">{t('admin.validator.subtitle')}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.validator.params')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('admin.validator.customer')}</Label>
            <CustomerPicker value={customer} onChange={setCustomer} />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.validator.product')}</Label>
            <ProductPicker value={product} onChange={setProduct} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="validator-qty">
                {t('admin.validator.quantity')}
              </Label>
              <Input
                id="validator-qty"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validator-total">
                {t('admin.validator.cartTotal')}
              </Label>
              <Input
                id="validator-total"
                inputMode="decimal"
                value={cartTotal}
                onChange={(e) => setCartTotal(e.target.value)}
              />
            </div>
          </div>
          <Button type="button" disabled={!ready || busy} onClick={run}>
            {t('admin.validator.run')}
          </Button>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {t('admin.validator.failed')}
            </p>
          )}
        </CardContent>
      </Card>
      {result && (
        <DiagnosisResult
          diagnosis={result}
          priceTypeName={names.priceTypeName(result.priceTypeId)}
          categoryName={names.categoryName(result.categoryId)}
        />
      )}
    </div>
  );
}
