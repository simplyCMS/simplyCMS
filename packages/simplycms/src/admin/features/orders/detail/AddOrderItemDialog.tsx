import { useRef, useState } from 'react';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'simplycms/ui/dialog';
import { Input } from 'simplycms/ui/input';
import { OrderModificationPicker } from './OrderModificationPicker';
import { QTY_MAX, QTY_MIN } from './OrderItemQuantity';
import { ProductSearchList, type ProductHit } from './ProductSearchList';
import { useOrderItemsEdit } from './useOrderItemsEdit';

/**
 * Діалог додавання товару в оформлене замовлення (Е5б-11): пошук → (вибір
 * модифікації) → кількість → «Додати». Успіх закриває діалог; відмова (409)
 * лишає його відкритим — тост уже показав `useOrderItemsEdit`. In-flight
 * `ref` (а не лише `busy`-стан) відсікає другий клік до перемальовки.
 */
export function AddOrderItemDialog({ orderId }: { readonly orderId: string }) {
  const t = useT();
  const edit = useOrderItemsEdit(orderId);
  const [open, setOpen] = useState(false);
  const [hit, setHit] = useState<ProductHit | null>(null);
  const [modId, setModId] = useState<string | null>(null);
  const [qty, setQty] = useState('1');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const n = Number(qty);
  const qtyValid =
    qty.trim() !== '' && Number.isInteger(n) && n >= QTY_MIN && n <= QTY_MAX;
  const ready =
    hit !== null && qtyValid && (!hit.hasModifications || modId !== null);

  const reset = () => {
    setHit(null);
    setModId(null);
    setQty('1');
  };
  const submit = async () => {
    if (!hit || !ready || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const ok = await edit.add({
        productId: hit.productId,
        modificationId: hit.hasModifications ? modId : null,
        quantity: n,
      });
      if (ok) {
        setOpen(false);
        reset();
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {t('admin.orders.addItem')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.orders.addItemTitle')}</DialogTitle>
          </DialogHeader>
          {hit === null ? (
            <ProductSearchList onSelect={setHit} />
          ) : (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={reset}>
                {t('admin.orders.backToSearch')}
              </Button>
              <p className="font-medium">{hit.name}</p>
              {hit.hasModifications && (
                <OrderModificationPicker
                  productId={hit.productId}
                  productName={hit.name}
                  value={modId}
                  onChange={setModId}
                />
              )}
              <Input
                type="number"
                inputMode="numeric"
                min={QTY_MIN}
                max={QTY_MAX}
                step={1}
                className="w-28"
                aria-label={t('common.quantity')}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              <Button disabled={!ready || busy} onClick={() => void submit()}>
                {t('admin.orders.addToOrder')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
