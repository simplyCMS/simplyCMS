import { useLocation } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import { Construction } from 'lucide-react';
import { useT, type MessageKey } from '@simplycms/i18n';

// Мапа ключів: сегмент URL → підпис розділу. Здебільшого збігається з бічним
// меню, тож ключі беруться звідти; два розділи мають на заглушці довшу назву.
const pageNameKeys: Record<string, MessageKey> = {
  'order-statuses': 'admin.common.placeholder.orderStatuses',
  services: 'admin.nav.services',
  'service-requests': 'admin.common.placeholder.serviceRequests',
  users: 'admin.nav.users',
  'user-categories': 'admin.nav.userCategories',
  languages: 'admin.nav.languages',
  settings: 'admin.nav.settings',
};

export default function PlaceholderPage() {
  const t = useT();
  const pathname = useLocation({ select: (l) => l.pathname });
  const pageName =
    pathname.split('/').pop() || t('admin.common.placeholder.fallback');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          {pageNameKeys[pageName] ? t(pageNameKeys[pageName]) : pageName}
        </h1>
        <p className="text-muted-foreground">
          {t('admin.common.placeholder.title')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-5 w-5" />
            {t('admin.common.placeholder.badge')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {t('admin.common.placeholder.text')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
