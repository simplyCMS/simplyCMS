import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { ThemeRegistry } from '@simplycms/themes/ThemeRegistry';
import { Button } from '@simplycms/ui/button';
import { Card, CardContent, CardHeader } from '@simplycms/ui/card';
import { Skeleton } from '@simplycms/ui/skeleton';
import { Palette, ArrowLeft } from 'lucide-react';
import { adminPath } from '../lib/adminLinks';
import { useT } from '@simplycms/i18n';
import { ThemeCard, type ThemeRecord } from '../components/ThemeCard';
import { ThemeActivateDialog } from '../components/ThemeActivateDialog';
import { useThemeActivate, THEMES_QUERY_KEY } from '../hooks/useThemeActivate';

export default function Themes() {
  const supabase = useSupabaseClient();
  const t = useT();
  const [confirmThemeId, setConfirmThemeId] = useState<string | null>(null);
  const { activateTheme, isActivating } = useThemeActivate(() =>
    setConfirmThemeId(null),
  );

  const { data: themes, isLoading } = useQuery({
    queryKey: THEMES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('themes')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ThemeRecord[];
    },
  });

  const themeToActivate = themes?.find((theme) => theme.id === confirmThemeId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={adminPath('settings')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{t('admin.themes.title')}</h1>
          <p className="text-muted-foreground">{t('admin.themes.subtitle')}</p>
        </div>
      </div>

      {isLoading ? (
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
      ) : themes?.length === 0 ? (
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
          {themes?.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              // Реєстр наповнює `src/theme-registry.ts` магазину — тобто тут
              // видно рівно ті теми, які реально встановлені в коді.
              hasModule={ThemeRegistry.has(theme.name)}
              isActivating={isActivating}
              onActivate={() => setConfirmThemeId(theme.id)}
            />
          ))}
        </div>
      )}

      <ThemeActivateDialog
        themeName={themeToActivate?.display_name ?? null}
        onOpenChange={() => setConfirmThemeId(null)}
        onConfirm={() => confirmThemeId && activateTheme(confirmThemeId)}
      />
    </div>
  );
}
