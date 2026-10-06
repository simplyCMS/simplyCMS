import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from 'simplycms/i18n';
import { ThemeRegistry } from 'simplycms/themes/ThemeRegistry';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader } from 'simplycms/ui/card';
import { Skeleton } from 'simplycms/ui/skeleton';
import { adminPath } from '../../lib/adminLinks';
import { reportTxError } from '../../lib/report-tx-error';
import { ThemeActivateDialog } from './ThemeActivateDialog';
import { ThemeCard } from './ThemeCard';
import { useThemes } from './useThemes';

/** Скелет сітки, поки `listThemes` не відповів. */
function ThemesSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2].map((i) => (
        <Card key={i}>
          <Skeleton className="h-48 w-full rounded-t-lg" />
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Сторінка «Теми оформлення» (Е6б-15): список і активація через serverFn. */
export default function ThemesPage() {
  const t = useT();
  const { query, activate } = useThemes();
  const [confirmName, setConfirmName] = useState<string | null>(null);
  const themes = query.data ?? [];
  const toActivate = themes.find((theme) => theme.name === confirmName);

  const confirm = () => {
    if (!confirmName) return;
    setConfirmName(null);
    activate.mutate(confirmName, {
      onSuccess: () =>
        toast.success(t('admin.themes.activated'), {
          description: t('admin.themes.appliedOnSite'),
        }),
      onError: (e) => reportTxError(t, e),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={adminPath('settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t('admin.themes.title')}</h1>
          <p className="text-muted-foreground">{t('admin.themes.subtitle')}</p>
        </div>
      </div>

      {query.isLoading ? (
        <ThemesSkeleton />
      ) : themes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Palette className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {t('admin.themes.empty')}
            </h3>
            <p className="text-muted-foreground">
              {t('admin.themes.emptyHint')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              // Реєстр наповнює `simplycms.config.ts` магазину — тут видно
              // рівно ті теми, що вшиті у збірку.
              hasModule={ThemeRegistry.has(theme.name)}
              isActivating={activate.isPending}
              onActivate={() => setConfirmName(theme.name)}
            />
          ))}
        </div>
      )}

      <ThemeActivateDialog
        themeName={toActivate?.displayName ?? null}
        onOpenChange={() => setConfirmName(null)}
        onConfirm={confirm}
      />
    </div>
  );
}
