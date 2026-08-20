import { Link } from '@tanstack/react-router';
import { ShoppingCart } from 'lucide-react';
import { useCart, useFormatPrice } from 'simplycms/react-query';
import { useT, type MessageKey } from 'simplycms/i18n';
import { CartItem } from './CartItem';

/**
 * Українська форма множини лічильника ("товар" / "товари" / "товарів").
 *
 * 🔴 Наївна умова `count < 5` (яку це замінює) хибно давала "few" для
 * 12–14 і 22–24: mod-100-виняток для 11..14 (завжди "many") має вищий
 * пріоритет за mod-10-правило "few" для 2..4.
 */
function pluralItemsKey(count: number): MessageKey {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'cart.itemsMany';
  if (mod10 === 1) return 'cart.itemsOne';
  if (mod10 >= 2 && mod10 <= 4) return 'cart.itemsFew';
  return 'cart.itemsMany';
}

export function CartDrawer() {
  const { items, totalItems, totalPrice, isOpen, setIsOpen } = useCart();
  const t = useT();
  const formatPrice = useFormatPrice();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => setIsOpen(false)}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:max-w-md bg-background shadow-lg flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {t('cart.title')}
            {totalItems > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({totalItems} {t(pluralItemsKey(totalItems))})
              </span>
            )}
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-6">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">{t('cart.empty.title')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('cart.empty.hint')}
            </p>
            <Link
              to="/catalog"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 border rounded-md text-sm"
            >
              {t('cart.empty.cta')}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6">
              <div className="space-y-0">
                {items.map((item) => (
                  <CartItem
                    key={`${item.productId}-${item.modificationId}`}
                    item={item}
                  />
                ))}
              </div>
            </div>

            <div className="mt-auto p-6 border-t">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('common.amount')}
                  </span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between font-medium text-lg">
                  <span>{t('cart.summary.total')}</span>
                  <span className="text-primary">
                    {formatPrice(totalPrice)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  to="/cart"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 text-center px-4 py-2 border rounded-md text-sm"
                >
                  {t('cart.viewCart')}
                </Link>
                <Link
                  to="/checkout"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 text-center px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
                >
                  {t('cart.summary.checkout')}
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
