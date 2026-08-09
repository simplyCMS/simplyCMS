import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { adminPath } from '../lib/adminLinks';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { useT } from '@simplycms/i18n';
import type { SupabaseClient } from '@simplycms/supabase/browser-client';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@simplycms/ui/table';
import { Badge } from '@simplycms/ui/badge';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

async function fetchOrders(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_statuses(name, color)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export default function Orders() {
  const navigate = useNavigate();
  const t = useT();
  const supabase = useSupabaseClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => fetchOrders(supabase),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.nav.orders')}</h1>
        <p className="text-muted-foreground">{t('admin.orders.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.orders.all')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.orders.number')}</TableHead>
                <TableHead>{t('admin.orders.customer')}</TableHead>
                <TableHead>{t('common.amount')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('common.date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders?.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    navigate({ to: adminPath(`orders/${order.id}`) })
                  }
                >
                  <TableCell className="font-medium">
                    {order.order_number}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div>
                        {order.first_name} {order.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{order.total.toLocaleString()} ₴</TableCell>
                  <TableCell>
                    <Badge
                      style={{
                        backgroundColor:
                          order.order_statuses?.color || '#6B7280',
                      }}
                    >
                      {order.order_statuses?.name || t('common.new')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(order.created_at), 'dd MMM yyyy, HH:mm', {
                      locale: uk,
                    })}
                  </TableCell>
                </TableRow>
              ))}
              {orders?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    {t('admin.orders.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
