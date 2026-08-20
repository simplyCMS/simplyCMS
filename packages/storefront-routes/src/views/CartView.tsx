import { Link } from '@tanstack/react-router';
import { ShoppingCart } from 'lucide-react';
import type { CartViewModel } from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { Button } from '@simplycms/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@simplycms/ui/card';
import { StorefrontBreadcrumbs } from './StorefrontBreadcrumbs';

/**
 * Канонічний view кошика (контракт тем v3).
 *
 * 🔴 Чиста функція від view-model: `itemCount` вирішує розмітку — порожній
 * кошик (без реквізитів, спека §5) чи блок купівлі (список / очистити /
 * підсумок / checkout). Самі дані й дії кошика прибінджені у slot-компонентах
 * (`useCart`, Ф2) — тут жодних запитів.
 */
export function CartView({ breadcrumbs, itemCount, slots }: CartViewModel) {
  const t = useT();

  return (
    <div className="container mx-auto px-4 py-8">
      <StorefrontBreadcrumbs items={breadcrumbs} />

      <h1 className="text-3xl font-bold mb-8">{t('cart.title')}</h1>

      {itemCount === 0 ? (
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
                  {t('cart.items', { count: itemCount })}
                </CardTitle>
                <slots.ClearCart />
              </CardHeader>
              <CardContent>
                <slots.Items />
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
                <slots.Summary />
              </CardContent>
              <CardFooter>
                <slots.Checkout />
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
