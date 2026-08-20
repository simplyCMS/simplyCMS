import { ShoppingCart } from 'lucide-react';
import { PRODUCT_DETAIL_REQUISITES } from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { useCart, type CartItem } from 'simplycms/react-query';
import { useToast } from '@simplycms/core/hooks/use-toast';
import { Button } from 'simplycms/ui/button';
import { cn } from 'simplycms/ui/utils';

/** Позиція, яку слот кладе в кошик (кількість додає сам кошик). */
export type AddToCartItem = Omit<CartItem, 'quantity'>;

export interface ProductAddToCartProps {
  className?: string;
  /** Готова позиція; `null` — ціну не визначено, купівля неможлива. */
  item: AddToCartItem | null;
  /** Наявність: `out_of_stock` вимикає кнопку. */
  inStock: boolean;
}

/**
 * Реквізит «купити»: кнопка з прибінджeною воронкою — запис у кошик і toast
 * підтвердження. Тема кнопку лише РОЗСТАВЛЯЄ і фарбує; зламати додавання в
 * кошик оформленням неможливо.
 */
export function ProductAddToCart({
  className,
  item,
  inStock,
}: ProductAddToCartProps) {
  const t = useT();
  const { addItem } = useCart();
  const { toast } = useToast();

  const handleClick = () => {
    if (!item) return;

    addItem(item);
    toast({
      title: t('product.addedToCart'),
      description: item.modificationName
        ? `${item.name} (${item.modificationName})`
        : item.name,
    });
  };

  return (
    <Button
      size="lg"
      data-simplycms-requisite={PRODUCT_DETAIL_REQUISITES.AddToCart}
      className={cn('flex-1 min-w-50', className)}
      disabled={!inStock || item === null}
      onClick={handleClick}
    >
      <ShoppingCart className="h-5 w-5 mr-2" />
      {t('product.addToCart')}
    </Button>
  );
}
