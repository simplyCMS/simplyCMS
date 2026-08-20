import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'simplycms/ui/card';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import {
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  Wrench,
  FileText,
} from 'lucide-react';
import { PluginSlot } from 'simplycms/plugins/PluginSlot';
import { Link } from '@tanstack/react-router';
import { adminPath } from '../lib/adminLinks';
import { useT, type MessageKey } from 'simplycms/i18n';

export default function Dashboard() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [products, sections, orders, profiles, services, serviceRequests] =
        await Promise.all([
          supabase
            .from('products')
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('sections')
            .select('id', { count: 'exact', head: true }),
          supabase.from('orders').select('id', { count: 'exact', head: true }),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('services')
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('service_requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'new'),
        ]);

      return {
        products: products.count || 0,
        sections: sections.count || 0,
        orders: orders.count || 0,
        users: profiles.count || 0,
        services: services.count || 0,
        newRequests: serviceRequests.count || 0,
      };
    },
  });

  const statCards: {
    titleKey: MessageKey;
    value: number;
    icon: typeof Package;
    color: string;
  }[] = [
    {
      titleKey: 'admin.nav.products',
      value: stats?.products || 0,
      icon: Package,
      color: 'text-blue-500',
    },
    {
      titleKey: 'admin.nav.sections',
      value: stats?.sections || 0,
      icon: FolderTree,
      color: 'text-green-500',
    },
    {
      titleKey: 'admin.nav.orders',
      value: stats?.orders || 0,
      icon: ShoppingCart,
      color: 'text-orange-500',
    },
    {
      titleKey: 'admin.nav.users',
      value: stats?.users || 0,
      icon: Users,
      color: 'text-purple-500',
    },
    {
      titleKey: 'admin.nav.services',
      value: stats?.services || 0,
      icon: Wrench,
      color: 'text-cyan-500',
    },
    {
      titleKey: 'admin.dashboard.newRequests',
      value: stats?.newRequests || 0,
      icon: FileText,
      color: 'text-red-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.dashboard.title')}</h1>
        <p className="text-muted-foreground">{t('admin.dashboard.subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.titleKey}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t(stat.titleKey)}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}

        {/* Plugin slot: additional stat cards from plugins */}
        <PluginSlot
          name="admin.dashboard.stats"
          context={{ stats }}
          wrapper={(children) => <>{children}</>}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.dashboard.quickActions')}</CardTitle>
            <CardDescription>
              {t('admin.dashboard.quickActionsHint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              to={adminPath('products')}
              className="block p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">
                    {t('admin.dashboard.addProduct')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('admin.dashboard.addProductHint')}
                  </div>
                </div>
              </div>
            </Link>
            <Link
              to={adminPath('sections')}
              className="block p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <FolderTree className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">
                    {t('admin.dashboard.manageSections')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('admin.dashboard.manageSectionsHint')}
                  </div>
                </div>
              </div>
            </Link>
            <Link
              to={adminPath('orders')}
              className="block p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">
                    {t('admin.dashboard.viewOrders')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('admin.dashboard.viewOrdersHint')}
                  </div>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('common.information')}</CardTitle>
            <CardDescription>{t('admin.dashboard.aboutTitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <p>{t('admin.dashboard.aboutText')}</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t('admin.dashboard.version')}
                  </span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t('admin.dashboard.status')}
                  </span>
                  <span className="text-green-500 font-medium">
                    {t('common.activeM')}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plugin slot: dashboard widgets from plugins */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <PluginSlot
          name="admin.dashboard.widgets"
          context={{ stats }}
          wrapper={(children) => <>{children}</>}
        />
      </div>
    </div>
  );
}
