import { Link } from '@tanstack/react-router';
import { ChevronRight, ShoppingCart } from 'lucide-react';
import { Button } from '@simplycms/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@simplycms/ui/card';
import { useCart } from '@simplycms/core/hooks/useCart';
import { useT } from '@simplycms/i18n';
import {
  CartCheckoutButton,
  CartClearButton,
  CartItemsList,
} from '../views/slots/CartSlots';
import { CartSummary } from '../views/slots/CartSummary';

export default function Cart() {
  const { items } = useCart();
  const t = useT();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Хлібні крихти */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors">
          {t('breadcrumbs.home')}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{t('cart.title')}</span>
      </nav>

      <h1 className="text-3xl font-bold mb-8">{t('cart.title')}</h1>

      {items.length === 0 ? (
        <Card className="max-w-lg mx-auto text-center">
          <CardContent className="pt-12 pb-8">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {t('cart.empty.title')}
            </h2>
            <p className="text-muted-foreground mb-6">
              {t('cart.empty.description')}
            </p>
            <Button asChild>
              <Link to="/catalog">{t('cart.empty.cta')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Позиції кошика */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">
                  {t('cart.items', { count: items.length })}
                </CardTitle>
                <CartClearButton />
              </CardHeader>
              <CardContent>
                <CartItemsList />
              </CardContent>
            </Card>
          </div>

          {/* Підсумок замовлення */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">
                  {t('cart.summary.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CartSummary />
              </CardContent>
              <CardFooter>
                <CartCheckoutButton />
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
