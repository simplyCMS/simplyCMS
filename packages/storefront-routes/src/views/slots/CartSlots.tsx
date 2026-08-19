import { Link } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { CART_REQUISITES } from '@simplycms/objects/views';
import { useT } from '@simplycms/i18n';
import { useCart } from '@simplycms/react-query';
import { CartItem } from '@simplycms/core/components/cart/CartItem';
import { Button } from '@simplycms/ui/button';
import { cn } from '@simplycms/ui/utils';

export interface CartSlotProps {
  className?: string;
}

/**
 * Реквізити кошика. Дані слоти беруть із самого кошика (`useCart`), тому
 * пропсів, крім оформлення, не мають — тема лише розставляє їх у лейауті.
 *
 * 🔴 Обгортки списку — `display: contents`: позиції лишаються прямими
 * дітьми контейнера теми, як були до виділення в слот.
 */
export function CartItemsList({ className }: CartSlotProps) {
  const { items } = useCart();

  return (
    <div
      data-simplycms-requisite={CART_REQUISITES.Items}
      className={cn('contents', className)}
    >
      {items.map((item) => (
        <CartItem
          key={`${item.productId}-${item.modificationId}`}
          item={item}
        />
      ))}
    </div>
  );
}

/** Реквізит «очистити кошик». */
export function CartClearButton({ className }: CartSlotProps) {
  const t = useT();
  const { clearCart } = useCart();

  return (
    <Button
      variant="ghost"
      size="sm"
      data-simplycms-requisite={CART_REQUISITES.ClearCart}
      className={cn('text-destructive hover:text-destructive', className)}
      onClick={clearCart}
    >
      <Trash2 className="h-4 w-4 mr-2" />
      {t('cart.clear')}
    </Button>
  );
}

/** Реквізит «перехід до оформлення». */
export function CartCheckoutButton({ className }: CartSlotProps) {
  const t = useT();

  return (
    <Button
      size="lg"
      asChild
      data-simplycms-requisite={CART_REQUISITES.Checkout}
      className={cn('w-full', className)}
    >
      <Link to="/checkout">{t('cart.summary.checkout')}</Link>
    </Button>
  );
}
