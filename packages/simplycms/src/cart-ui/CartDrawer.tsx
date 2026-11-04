import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ShoppingCart } from 'lucide-react';
import type { AvailableCartQuoteLine, CartQuote } from 'simplycms/contracts';
import { useCart } from 'simplycms/react-query';
import { plural, useT } from 'simplycms/i18n';
import { CartItem } from './CartItem';
import { CartDrawerFooter } from './CartDrawerFooter';
import { findQuoteLine, hasUnavailableItem } from './quote-line';

export interface CartDrawerProps {
  /**
   * Серверна квота кошика (Е6в-13); `null` — ще немає (скелети, а не 0).
   * `cart-ui` (T4) serverFn не імпортує: квоту дає T5-контейнер
   * (`core/components/cart/CartDrawer`).
   */
  quote: CartQuote | null;
  /** Запит квоти впав — показати помилку з повтором, а не скелети. */
  failed?: boolean;
  onRetry?: () => void;
  /** Порогові підказки доступного рядка — рендерить контейнер. */
  renderHints?: (line: AvailableCartQuoteLine) => ReactNode;
}

export function CartDrawer({
  quote,
  failed = false,
  onRetry = () => {},
  renderHints,
}: CartDrawerProps) {
  const { items, totalItems, isOpen, setIsOpen } = useCart();
  const t = useT();

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
                ({plural(t, 'cart.items', totalItems)})
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
                {items.map((item) => {
                  const line = findQuoteLine(quote, item);
                  return (
                    <CartItem
                      key={`${item.productId}-${item.modificationId}`}
                      item={item}
                      line={line}
                      failed={failed}
                      hints={line?.available ? renderHints?.(line) : null}
                    />
                  );
                })}
              </div>
            </div>

            <CartDrawerFooter
              quote={quote}
              failed={failed}
              onRetry={onRetry}
              blocked={hasUnavailableItem(quote, items)}
              onClose={() => setIsOpen(false)}
            />
          </>
        )}
      </div>
    </div>
  );
}
