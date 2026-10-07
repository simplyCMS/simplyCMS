import { CartDrawer as CartDrawerView } from 'simplycms/cart-ui';
import { DiscountHints } from 'simplycms/catalog-ui/DiscountHints';
import { useCart } from 'simplycms/react-query';
import { useCartQuote } from '../../hooks/useCartQuote';

/**
 * Drawer кошика — T5-контейнер (Е6в-13): бере серверну квоту й віддає її
 * presentational-drawer'у з `cart-ui` разом із підказками порогів.
 *
 * 🔴 `cart-ui` (T4) не імпортує ні serverFn, ні `catalog-ui` (той самий тір):
 * квоту й `DiscountHints` сюди приносить цей контейнер. Теми монтують drawer
 * саме за цим шляхом (`simplycms/core/components/cart/CartDrawer`) без
 * пропсів — контракт тем незмінний.
 *
 * 🔴 Квота питається лише коли drawer ВІДКРИТИЙ: шапка тримає його на
 * кожній сторінці, і закритий drawer не має бити сервер на кожен перехід.
 */
export function CartDrawer() {
  const { isOpen } = useCart();
  return isOpen ? <QuotedCartDrawer /> : null;
}

function QuotedCartDrawer() {
  const { quote, isError, refetch } = useCartQuote();
  return (
    <CartDrawerView
      quote={quote}
      failed={isError}
      onRetry={refetch}
      renderHints={(line) => (
        <DiscountHints hints={line.hints} className="mt-1 text-right" />
      )}
    />
  );
}
