import { PluginSlot } from 'simplycms/plugins/PluginSlot';
import { useT } from 'simplycms/i18n';
import type { AdminDashboardStats } from 'simplycms/contracts/objects';
import DashboardInfoCards from './DashboardInfoCards';
import DashboardStatCards from './DashboardStatCards';
import RecentOrdersCard from './RecentOrdersCard';
import { useDashboardSummary } from './useDashboardSummary';

/** Дашборд адмінки на серверному шарі: `dashboardSummary` + слоти плагінів. */
export default function DashboardPage() {
  const t = useT();
  const { data } = useDashboardSummary();
  // Слот отримує рівно контрактну форму `AdminDashboardStats` (без списку) і
  // лише коли дані є: плагін не мусить обробляти `stats: undefined`.
  const stats: AdminDashboardStats | undefined = data && {
    newOrders: data.newOrders,
    revenue7dCents: data.revenue7dCents,
    revenue30dCents: data.revenue30dCents,
  };
  const passthrough = (children: React.ReactNode) => <>{children}</>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.dashboard.title')}</h1>
        <p className="text-muted-foreground">{t('admin.dashboard.subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DashboardStatCards summary={data} />
        {stats && (
          <PluginSlot
            name="admin.dashboard.stats"
            context={{ stats }}
            wrapper={passthrough}
          />
        )}
      </div>

      <RecentOrdersCard orders={data?.recentOrders ?? []} />
      <DashboardInfoCards />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats && (
          <PluginSlot
            name="admin.dashboard.widgets"
            context={{ stats }}
            wrapper={passthrough}
          />
        )}
      </div>
    </div>
  );
}
