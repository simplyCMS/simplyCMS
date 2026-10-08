import { Link } from '@tanstack/react-router';
import { FolderTree, Package, ShoppingCart } from 'lucide-react';
import { CORE_VERSION } from 'simplycms/contracts/semver';
import { useT, type MessageKey } from 'simplycms/i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'simplycms/ui/card';
import { adminPath } from '../../lib/adminLinks';

const ACTIONS: readonly {
  sub: string;
  icon: typeof Package;
  title: MessageKey;
  hint: MessageKey;
}[] = [
  {
    sub: 'products',
    icon: Package,
    title: 'admin.dashboard.addProduct',
    hint: 'admin.dashboard.addProductHint',
  },
  {
    sub: 'sections',
    icon: FolderTree,
    title: 'admin.dashboard.manageSections',
    hint: 'admin.dashboard.manageSectionsHint',
  },
  {
    sub: 'orders',
    icon: ShoppingCart,
    title: 'admin.dashboard.viewOrders',
    hint: 'admin.dashboard.viewOrdersHint',
  },
];

/** Швидкі дії та блок «про систему» (лише версія ядра). */
export default function DashboardInfoCards() {
  const t = useT();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.dashboard.quickActions')}</CardTitle>
          <CardDescription>
            {t('admin.dashboard.quickActionsHint')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {ACTIONS.map(({ sub, icon: Icon, title, hint }) => (
            <Link
              key={sub}
              to={adminPath(sub)}
              className="block p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">{t(title)}</div>
                  <div className="text-sm text-muted-foreground">{t(hint)}</div>
                </div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('common.information')}</CardTitle>
          <CardDescription>{t('admin.dashboard.aboutTitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>{t('admin.dashboard.aboutText')}</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t('admin.dashboard.version')}
            </span>
            <span className="font-medium">{CORE_VERSION}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
