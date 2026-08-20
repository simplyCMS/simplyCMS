import { useEffect, useState } from 'react';
import {
  useParams,
  useSearch,
  useNavigate,
  Link,
} from '@tanstack/react-router';
import {
  CheckCircle2,
  Package,
  ChevronRight,
  Home,
  User,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Separator } from 'simplycms/ui/separator';
import { Skeleton } from 'simplycms/ui/skeleton';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT, type MessageKey } from 'simplycms/i18n';
import { useAuth } from '@simplycms/core/hooks/useAuth';
import { toast } from '@simplycms/core/hooks/use-toast';
import { useFormatPrice } from 'simplycms/react-query';

interface OrderDetails {
  id: string;
  order_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  delivery_method: string;
  delivery_city: string | null;
  delivery_address: string | null;
  payment_method: string;
  subtotal: number;
  total: number;
  created_at: string;
  status: {
    name: string;
    color: string | null;
  } | null;
  items: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
  }[];
}

// Мапи ключів, а не текстів: код способу приходить із БД, тож розкладка
// «код → ключ каталогу» лишається на рівні модуля, а текст резолвиться під час
// рендера. Новий код доставки без ключа стане помилкою типізації.
const deliveryLabels: Record<string, MessageKey> = {
  pickup: 'checkout.shipping.pickup',
  nova_poshta: 'checkout.shipping.novaPoshta',
  courier: 'checkout.shipping.courier',
};

const paymentLabels: Record<string, MessageKey> = {
  cash: 'checkout.payment.cash',
  online: 'checkout.payment.online',
};

export default function OrderSuccess() {
  const t = useT();
  const supabase = useSupabaseClient();
  const params = useParams({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const orderId = params.orderId as string;
  const search = useSearch({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const token = search.token ?? null;
  const { user } = useAuth();
  const navigate = useNavigate({ from: '/order-success/$orderId' });

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) return;

      try {
        let query = supabase
          .from('orders')
          .select(
            `
            *,
            status:order_statuses(name, color),
            items:order_items(id, name, price, quantity, total)
          `,
          )
          .eq('id', orderId);

        // If user is logged in, check ownership
        if (user) {
          query = query.eq('user_id', user.id);
        } else if (token) {
          // For guest orders, use access_token
          query = query.eq('access_token', token);
        } else {
          setIsLoading(false);
          return;
        }

        const { data, error } = await query.single();

        if (error) throw error;
        setOrder(data as OrderDetails);

        // Guest-token одноразовий: після успішного завантаження прибираємо
        // його з URL, щоб він не лишався в історії/логах/шарінгу посилання.
        navigate({
          search: (s) => {
            const rest = { ...s };
            delete rest.token;
            return rest;
          },
          replace: true,
        });
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigate стабільний з @tanstack/react-router
  }, [orderId, token, user, supabase]);

  // Форматування ціни — через конфіг магазину (locale/currency), а не
  // хардкод 'uk-UA'/'UAH': символ валюти більше не залежить від CLDR рушія
  // (див. simplycms/domain/money).
  const formatPrice = useFormatPrice();

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const copyOrderNumber = () => {
    if (order?.order_number) {
      navigator.clipboard.writeText(order.order_number);
      setCopied(true);
      toast({
        title: t('checkout.success.copied'),
        description: t('checkout.success.copiedHint'),
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-12 w-3/4 mx-auto" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-lg mx-auto text-center">
          <CardContent className="pt-12 pb-8">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <Package className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {t('checkout.success.notFound')}
            </h2>
            <p className="text-muted-foreground mb-6">
              {t('checkout.success.notFoundHint')}
            </p>
            <Button asChild>
              <Link to="/">{t('checkout.success.toHome')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors">
          {t('breadcrumbs.home')}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{t('checkout.success.title')}</span>
      </nav>

      <div className="max-w-2xl mx-auto">
        {/* Success header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {t('checkout.success.thanks')}
          </h1>
          <p className="text-muted-foreground">
            {t('checkout.success.sentTo')} {order.email}
          </p>
        </div>

        {/* Order number card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('checkout.success.orderNumber')}
                </p>
                <p className="text-2xl font-bold">{order.order_number}</p>
              </div>
              <Button variant="outline" size="icon" onClick={copyOrderNumber}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: order.status?.color || '#gray' }}
              />
              <span className="text-sm">
                {order.status?.name || t('common.new')}
              </span>
              <span className="text-sm text-muted-foreground ml-auto">
                {formatDate(order.created_at)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Order details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">
              {t('checkout.success.details')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Items */}
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantity} x {formatPrice(item.price)}
                    </p>
                  </div>
                  <p className="font-medium">{formatPrice(item.total)}</p>
                </div>
              ))}
            </div>

            <Separator />

            <div className="flex justify-between font-semibold text-lg">
              <span>{t('common.total')}</span>
              <span className="text-primary">{formatPrice(order.total)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Delivery & Payment info */}
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t('cart.summary.shipping')}
                </p>
                <p className="font-medium">
                  {deliveryLabels[order.delivery_method]
                    ? t(deliveryLabels[order.delivery_method])
                    : order.delivery_method}
                </p>
                {order.delivery_city && (
                  <p className="text-sm text-muted-foreground">
                    {order.delivery_city}
                    {order.delivery_address && `, ${order.delivery_address}`}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t('checkout.success.payment')}
                </p>
                <p className="font-medium">
                  {paymentLabels[order.payment_method]
                    ? t(paymentLabels[order.payment_method])
                    : order.payment_method}
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {t('checkout.success.recipient')}
              </p>
              <p className="font-medium">
                {order.first_name} {order.last_name}
              </p>
              <p className="text-sm text-muted-foreground">{order.phone}</p>
              <p className="text-sm text-muted-foreground">{order.email}</p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="outline" asChild>
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              {t('checkout.success.toHome')}
            </Link>
          </Button>
          {user && (
            <Button asChild>
              <Link to="/profile/orders">
                <User className="h-4 w-4 mr-2" />
                {t('nav.orders')}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
