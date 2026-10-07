import { Link } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { CART_REQUISITES } from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { useCart } from 'simplycms/react-query';
import { findQuoteLine, hasUnavailableItem } from 'simplycms/cart-ui';
import { DiscountHints } from 'simplycms/catalog-ui/DiscountHints';
import { CartItem } from 'simplycms/core/components/cart/CartItem';
import { useCartQuote } from 'simplycms/core/hooks/useCartQuote';
import { Button } from 'simplycms/ui/button';
import { cn } from 'simplycms/ui/utils';

export interface CartSlotProps {
  className?: string;
}

/**
 * Реквізити кошика. Дані слоти беруть із самого кошика (`useCart`) і з
 * серверної квоти (`useCartQuote`, Е6в-13), тому пропсів, крім оформлення,
 * не мають — тема лише розставляє їх у лейауті.
 *
 * 🔴 Обгортки списку — `display: contents`: позиції лишаються прямими
 * дітьми контейнера теми, як були до виділення в слот.
 */
export function CartItemsList({ className }: CartSlotProps) {
  const { items } = useCart();
  const { quote, isError } = useCartQuote();

  return (
    <div
      data-simplycms-requisite={CART_REQUISITES.Items}
      className={cn('contents', className)}
    >
      {items.map((item) => {
        const line = findQuoteLine(quote, item);
        return (
          <CartItem
            key={`${item.productId}-${item.modificationId}`}
            item={item}
            line={line}
            failed={isError}
            hints={
              line?.available ? (
                <DiscountHints hints={line.hints} className="mt-1 text-right" />
              ) : null
            }
          />
        );
      })}
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

/**
 * Реквізит «перехід до оформлення». Недоступна позиція в кошику (Е6в-13) —
 * кнопка вимкнена з поясненням: сервер однаково відмовив би `not_purchasable`.
 * Маркер реквізиту — на кнопці в обох станах.
 */
export function CartCheckoutButton({ className }: CartSlotProps) {
  const t = useT();
  const { items } = useCart();
  const { quote } = useCartQuote();

  if (hasUnavailableItem(quote, items)) {
    return (
      <>
        <Button
          size="lg"
          disabled
          data-simplycms-requisite={CART_REQUISITES.Checkout}
          className={cn('w-full', className)}
        >
          {t('cart.summary.checkout')}
        </Button>
        <p className="text-xs text-destructive">
          {t('cart.removeUnavailable')}
        </p>
      </>
    );
  }

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
