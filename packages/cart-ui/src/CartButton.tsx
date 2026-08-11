import { ShoppingCart } from 'lucide-react';
import { useCart } from '@simplycms/react-query';
import { useT } from '@simplycms/i18n';

export function CartButton() {
  const { totalItems, setIsOpen } = useCart();
  const t = useT();

  return (
    <button
      className="gradient-brand text-white border-0 gap-2 relative inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium"
      onClick={() => setIsOpen(true)}
    >
      <ShoppingCart className="h-4 w-4" />
      <span className="hidden sm:inline">{t('cart.title')}</span>
      {totalItems > 0 && (
        <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs font-medium flex items-center justify-center">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </button>
  );
}
