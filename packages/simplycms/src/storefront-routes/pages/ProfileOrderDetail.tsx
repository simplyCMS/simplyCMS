import { useState } from 'react';
import { useParams, useNavigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Package,
  Calendar,
  MapPin,
  CreditCard,
  User,
  XCircle,
  Loader2,
  UserPlus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Button } from 'simplycms/ui/button';
import { Badge } from 'simplycms/ui/badge';
import { Separator } from 'simplycms/ui/separator';
import { Skeleton } from 'simplycms/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'simplycms/ui/alert-dialog';
import { useAuth } from 'simplycms/core/hooks/useAuth';
import { useT, type MessageKey } from 'simplycms/i18n';
import { toast } from 'simplycms/core/hooks/use-toast';
import { useFormatPrice } from 'simplycms/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { cancelMyOrder, getMyOrder } from '../server/profile-orders';

const orders = entityKey(ENTITY.orders);

// Мапи ключів, а не текстів: код способу приходить із БД (див. OrderSuccess).
const deliveryLabels: Record<string, MessageKey> = {
  pickup: 'checkout.shipping.pickup',
  nova_poshta: 'checkout.shipping.novaPoshta',
  courier: 'checkout.shipping.courier',
};

const paymentLabels: Record<string, MessageKey> = {
  cash: 'checkout.payment.cash',
  online: 'checkout.payment.online',
};

/** Причина відмови від скасування → ключ каталогу повідомлень. */
const cancelFailures: Record<string, MessageKey> = {
  not_found: 'profile.order.cancel.notAuthorized',
  not_cancellable: 'profile.order.cancel.failed',
  status_missing: 'profile.order.cancel.statusMissing',
};

export default function ProfileOrderDetailPage() {
  const t = useT();
  const params = useParams({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const orderId = params?.orderId as string | undefined;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCancelling, setIsCancelling] = useState(false);

  /**
   * 🔴 Замовлення читає СЕРВЕР під актором власника сесії. Чуже замовлення
   * повертається як `null` — не тому, що код його відфільтрував, а тому що
   * політика `orders_select_own_or_token` не віддала рядок актору.
   */
  const { data: order, isLoading } = useQuery({
    queryKey: [...orders.detail(orderId ?? ''), user?.id],
    queryFn: () => getMyOrder({ data: { orderId: orderId as string } }),
    enabled: !!user && !!orderId,
  });

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

  const canCancel = order?.status?.code === 'new';

  /**
   * 🔴 Скасування — серверна операція: `0002_grants.sql` навмисно не дає
   * `app_user` UPDATE на `orders`. Сервер спершу доводить право читанням під
   * актором покупця й лише потім пише під `app_admin`.
   */
  const handleCancel = async () => {
    if (!order) return;
    setIsCancelling(true);

    try {
      const result = await cancelMyOrder({ data: { orderId: order.id } });

      if (!result.ok) {
        toast({
          title: t('common.error'),
          description: t(
            cancelFailures[result.reason] ?? 'profile.order.cancel.failed',
          ),
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: t('profile.order.cancel.done'),
        description: t('profile.order.cancel.doneHint', {
          number: order.order_number,
        }),
      });

      navigate({ to: '/profile/orders' });
    } catch (error: unknown) {
      console.error('Error cancelling order:', error);
      toast({
        title: t('common.error'),
        description: t('profile.order.cancel.failed'),
        variant: 'destructive',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t('profile.order.notFound')}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t('profile.order.notFoundHint')}
          </p>
          <Button asChild>
            <Link to="/profile/orders">{t('nav.orders')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/profile/orders">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{order.order_number}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {formatDate(order.created_at)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {order.status && (
            <Badge
              variant="outline"
              className="text-sm py-1 px-3"
              style={{
                borderColor: order.status.color || undefined,
                color: order.status.color || undefined,
              }}
            >
              {order.status.name}
            </Badge>
          )}

          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <XCircle className="h-4 w-4 mr-2" />
                  {t('common.cancel')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t('profile.order.cancel.confirmTitle')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('profile.order.cancel.confirmText', {
                      number: order.order_number,
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {t('profile.order.cancel.keep')}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    disabled={isCancelling}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('profile.order.cancel.pending')}
                      </>
                    ) : (
                      t('profile.order.cancel.confirm')
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Order items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('profile.order.items')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-3 border-b last:border-0"
            >
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} × {formatPrice(item.price)}
                </p>
                {item.base_price && item.base_price > item.price && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="line-through">
                      {formatPrice(item.base_price)}
                    </span>
                  </p>
                )}
              </div>
              <p className="font-semibold">{formatPrice(item.total)}</p>
            </div>
          ))}

          <Separator />

          <div className="flex justify-between text-lg font-semibold">
            <span>{t('common.total')}</span>
            <span className="text-primary">{formatPrice(order.total)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Delivery & Payment */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {t('cart.summary.shipping')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">
                {t('profile.order.shippingMethod')}
              </p>
              <p className="font-medium">
                {deliveryLabels[order.delivery_method || '']
                  ? t(deliveryLabels[order.delivery_method || ''])
                  : order.delivery_method || t('common.notSet')}
              </p>
            </div>
            {order.delivery_city && (
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('common.city')}
                </p>
                <p className="font-medium">{order.delivery_city}</p>
              </div>
            )}
            {order.delivery_address && (
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('common.address')}
                </p>
                <p className="font-medium">{order.delivery_address}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t('checkout.success.payment')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('profile.order.paymentMethod')}
              </p>
              <p className="font-medium">
                {paymentLabels[order.payment_method]
                  ? t(paymentLabels[order.payment_method])
                  : order.payment_method}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('profile.order.customer')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {t('common.firstName')}
              </p>
              <p className="font-medium">
                {order.first_name} {order.last_name}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('common.phone')}
              </p>
              <p className="font-medium">{order.phone}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{order.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recipient info - if different from customer */}
      {order.has_different_recipient && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {t('checkout.success.recipient')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('common.firstName')}
                </p>
                <p className="font-medium">
                  {order.recipient_first_name} {order.recipient_last_name}
                </p>
              </div>
              {order.recipient_phone && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('common.phone')}
                  </p>
                  <p className="font-medium">{order.recipient_phone}</p>
                </div>
              )}
              {order.recipient_email && (
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{order.recipient_email}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t('profile.order.comment')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{order.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
