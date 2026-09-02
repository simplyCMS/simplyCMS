import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  Mail,
  Phone,
  Package,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Button } from 'simplycms/ui/button';
import { Skeleton } from 'simplycms/ui/skeleton';
import { Badge } from 'simplycms/ui/badge';
import { useAuth } from 'simplycms/core/hooks/useAuth';
import { useT } from 'simplycms/i18n';
import { useFormatPrice } from 'simplycms/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { getProfileOverview } from '../server/profile';

/**
 * 🔴 Огляд читає `profiles` + останні `orders`, але `profiles` лишається
 * якорем: це «моя картка профілю», а замовлення — вкладений вихлоп для
 * блоку «останні замовлення».
 */
const profiles = entityKey(ENTITY.profiles);

export default function ProfilePage() {
  const t = useT();
  const { user } = useAuth();

  /**
   * 🔴 Профіль і замовлення тягне СЕРВЕР під актором власника сесії. Раніше
   * браузер сам ставив `user_id` у запит — тобто ідентичність, за якою
   * читались персональні дані, приходила з клієнта. Тепер її задає
   * `readSessionSubject`, і підставити чужий id нема куди: параметра немає.
   */
  const { data, isLoading } = useQuery({
    queryKey: profiles.scoped('overview', user?.id ?? ''),
    queryFn: () => getProfileOverview(),
    enabled: !!user,
  });

  const profile = data?.profile ?? null;
  const recentOrders = data?.recentOrders ?? [];

  // Форматування ціни — через конфіг магазину (locale/currency), а не
  // хардкод 'uk-UA'/'UAH': символ валюти більше не залежить від CLDR рушія
  // (див. simplycms/domain/money).
  const formatPrice = useFormatPrice();

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateString));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('profile.title')}</h1>

      {/* Profile info card */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('profile.personalData')}
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link to="/profile/settings">{t('common.edit')}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('common.firstName')}
                </p>
                <p className="font-medium">
                  {profile?.first_name && profile?.last_name
                    ? `${profile.first_name} ${profile.last_name}`
                    : t('common.notSet')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">
                  {profile?.email || user?.email || t('common.notSet')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('common.phone')}
                </p>
                <p className="font-medium">
                  {profile?.phone || t('common.notSet')}
                </p>
              </div>
            </div>

            {profile?.category && (
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('common.category')}
                  </p>
                  <Badge variant="secondary">{profile.category.name}</Badge>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent orders card */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('profile.recentOrders')}
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link to="/profile/orders">{t('profile.allOrders')}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t('profile.noOrders')}</p>
              <Button className="mt-4" asChild>
                <Link to="/catalog">{t('cart.empty.cta')}</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to="/profile/orders/$orderId"
                  params={{ orderId: order.id }}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{order.order_number}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {formatDate(order.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatPrice(order.total)}
                      </p>
                      {order.status && (
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: order.status.color || undefined,
                            color: order.status.color || undefined,
                          }}
                        >
                          {order.status.name}
                        </Badge>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
