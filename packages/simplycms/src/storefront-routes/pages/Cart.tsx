import { useCart } from 'simplycms/react-query';
import { useT } from 'simplycms/i18n';
import { CartView } from '../views/CartView';
import { useStorefrontViews } from '../views/useStorefrontViews';
import { buildCartBreadcrumbs } from './cart/breadcrumbs';
import { cartSlots } from './cart/slots';

/**
 * Контейнер кошика: рахує позиції — і віддає готовий view-model view
 * (темовому, якщо тема заявила `Cart`, інакше канонічному).
 */
export default function Cart() {
  const { items } = useCart();
  const t = useT();
  const views = useStorefrontViews({ Cart: CartView });

  return (
    <views.Cart
      breadcrumbs={buildCartBreadcrumbs(t)}
      itemCount={items.length}
      slots={cartSlots}
    />
  );
}
