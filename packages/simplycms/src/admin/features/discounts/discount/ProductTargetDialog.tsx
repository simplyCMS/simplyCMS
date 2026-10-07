import { useState } from 'react';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'simplycms/ui/dialog';
import { Plus } from 'lucide-react';
import { OrderModificationPicker } from '../../orders/detail/OrderModificationPicker';
import {
  ProductSearchList,
  type ProductHit,
} from '../../orders/detail/ProductSearchList';
import type { FormTarget } from './discount-form-schema';

interface Props {
  readonly onAdd: (target: FormTarget) => void;
}

/**
 * Ціль-товар або ціль-модифікація: пошук товару (той самий серверний пошук і
 * вибір модифікації, що й у картці замовлення), далі — увесь товар чи
 * конкретна модифікація.
 */
export function ProductTargetDialog({ onAdd }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [hit, setHit] = useState<ProductHit | null>(null);
  const close = () => {
    setOpen(false);
    setHit(null);
  };
  const add = (target: FormTarget) => {
    onAdd(target);
    close();
  };
  const pick = (h: ProductHit) =>
    h.hasModifications
      ? setHit(h)
      : add({ targetType: 'product', targetId: h.productId });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-1 h-4 w-4" />
        {t('admin.discounts.addProduct')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.discounts.addProduct')}</DialogTitle>
          </DialogHeader>
          {hit === null ? (
            <ProductSearchList onSelect={pick} />
          ) : (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setHit(null)}>
                {t('admin.orders.backToSearch')}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() =>
                  add({ targetType: 'product', targetId: hit.productId })
                }
              >
                {t('admin.discounts.wholeProduct', { name: hit.name })}
              </Button>
              <OrderModificationPicker
                productId={hit.productId}
                productName={hit.name}
                value={null}
                onChange={(id) =>
                  add({ targetType: 'modification', targetId: id })
                }
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
