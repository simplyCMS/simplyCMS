import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Package, Calendar, ChevronRight, Filter } from 'lucide-react';
import { Card, CardContent } from 'simplycms/ui/card';
import { Button } from 'simplycms/ui/button';
import { Badge } from 'simplycms/ui/badge';
import { Skeleton } from 'simplycms/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import { useAuth } from 'simplycms/core/hooks/useAuth';
import { useT } from 'simplycms/i18n';
import { useFormatPrice } from 'simplycms/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { getMyOrders, getOrderStatuses } from '../server/profile-orders';

/** Значення фільтра «усі статуси». */
const ALL_STATUSES = 'all';

// 🔴 Не `orders` — це імʼя вже займає локальний `data: orders` нижче
// (перезапис module-level фабрики в тілі компонента дав би TDZ-помилку).
const orderKeys = entityKey(ENTITY.orders);
const orderStatuses = entityKey(ENTITY.orderStatuses);

export default function ProfileOrdersPage() {
  const t = useT();
  const { user } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<string>(ALL_STATUSES);

  const { data: statuses = [] } = useQuery({
    queryKey: orderStatuses.list(),
    queryFn: () => getOrderStatuses(),
  });

  /**
   * 🔴 Список замовлень — під актором власника сесії (див. `Profile.tsx`).
   * Фільтр статусу їде параметром, бо він і є вибором користувача; чиї саме
   * замовлення показати — параметром НЕ їде і їхати не може.
   */
  const { data: orders = [], isLoading } = useQuery({
    queryKey: [...orderKeys.scoped('customer', user?.id ?? ''), selectedStatus],
    queryFn: () =>
      getMyOrders({
        data:
          selectedStatus === ALL_STATUSES ? {} : { statusId: selectedStatus },
      }),
    enabled: !!user,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('profile.orders.title')}</h1>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('profile.orders.allStatuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>
                {t('profile.orders.allStatuses')}
              </SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: status.color || '#gray' }}
                    />
                    {status.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {t(
                selectedStatus === ALL_STATUSES
                  ? 'profile.noOrders'
                  : 'profile.orders.noneForStatus',
              )}
            </h2>
            <p className="text-muted-foreground mb-4">
              {t(
                selectedStatus === ALL_STATUSES
                  ? 'profile.orders.emptyHint'
                  : 'profile.orders.filterHint',
              )}
            </p>
            {selectedStatus === ALL_STATUSES && (
              <Button asChild>
                <Link to="/catalog">{t('cart.empty.cta')}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              to="/profile/orders/$orderId"
              params={{ orderId: order.id }}
              className="block"
            >
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-lg">
                          {order.order_number}
                        </span>
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

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {formatDate(order.created_at)}
                      </div>

                      <div className="text-sm text-muted-foreground">
                        {order.items.slice(0, 2).map((item, i) => (
                          <span key={item.id}>
                            {i > 0 && ', '}
                            {item.name} ×{item.quantity}
                          </span>
                        ))}
                        {order.items.length > 2 && (
                          <span>
                            {' '}
                            {t('profile.orders.moreItems', {
                              count: order.items.length - 2,
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {t('common.amount')}
                        </p>
                        <p className="text-xl font-bold text-primary">
                          {formatPrice(order.total)}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
