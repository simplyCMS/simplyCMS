import { Link } from '@tanstack/react-router';
import { ArrowLeft, Puzzle } from 'lucide-react';
import { useT } from 'simplycms/i18n';
import { getRegisteredPluginModules } from 'simplycms/plugins';
import { Badge } from 'simplycms/ui/badge';
import { Button } from 'simplycms/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'simplycms/ui/card';
import { Skeleton } from 'simplycms/ui/skeleton';
import { adminPath } from '../../lib/adminLinks';
import { PluginCard } from './PluginCard';
import { usePluginToggle } from './usePluginToggle';
import { usePlugins } from './usePlugins';

/** Модулі плагінів у збірці — довідка, що саме вшито в магазин. */
function RegisteredModules({ names }: { names: string[] }) {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.plugins.modules')}</CardTitle>
        <CardDescription>{t('admin.plugins.modulesHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        {names.length === 0 ? (
          <p className="text-muted-foreground">
            {t('admin.plugins.modulesEmpty')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {names.map((name) => (
              <Badge key={name} variant="outline">
                {name}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Сторінка «Плагіни» (Е6б-17): список, перемикач, перехід до налаштувань. */
export default function PluginsPage() {
  const t = useT();
  const { query } = usePlugins();
  const { toggle, togglingPlugin } = usePluginToggle();
  // Реєстр наповнює bootstrap асинхронно ПІСЛЯ першого рендера — читаємо на
  // кожен рендер, без мемоїзації, інакше «модуля немає» закешувалось би.
  const modules = getRegisteredPluginModules();
  const plugins = query.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={adminPath()}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t('admin.nav.plugins')}</h1>
          <p className="text-muted-foreground">{t('admin.plugins.subtitle')}</p>
        </div>
      </div>

      {query.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : plugins.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Puzzle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {t('admin.plugins.empty')}
            </h3>
            <p className="text-muted-foreground text-center max-w-md">
              {t('admin.plugins.emptyHint')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              hasModule={modules.has(plugin.name)}
              isToggling={togglingPlugin === plugin.name}
              onToggle={(isActive) => toggle({ name: plugin.name, isActive })}
            />
          ))}
        </div>
      )}

      <RegisteredModules names={[...modules.keys()]} />
    </div>
  );
}
