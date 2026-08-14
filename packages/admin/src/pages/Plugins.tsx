import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink } from '@simplycms/core/components/NavLink';
import { Button } from '@simplycms/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@simplycms/ui/card';
import { Switch } from '@simplycms/ui/switch';
import { Badge } from '@simplycms/ui/badge';
import { Skeleton } from '@simplycms/ui/skeleton';
import { useToast } from '@simplycms/core/hooks/use-toast';
import { ArrowLeft, Puzzle, Settings, Trash2 } from 'lucide-react';
import { adminPath } from '../lib/adminLinks';
import {
  getRegisteredPluginModules,
  uninstallPlugin,
} from '@simplycms/plugins';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { useT } from '@simplycms/i18n';
import {
  parsePlugin,
  type ParsedPlugin,
  type Plugin,
} from '@simplycms/plugins/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@simplycms/ui/alert-dialog';
import { usePluginToggle, PLUGINS_QUERY_KEY } from '../hooks/usePluginToggle';

export default function Plugins() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { togglePlugin, togglingPlugin } = usePluginToggle();

  const { data: plugins, isLoading } = useQuery({
    queryKey: PLUGINS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plugins')
        .select('*')
        .order('display_name', { ascending: true });
      if (error) throw error;
      return (data || []) as Plugin[];
    },
  });

  const parsedPlugins: ParsedPlugin[] = (plugins || []).map(parsePlugin);
  const registeredModules = getRegisteredPluginModules();

  const uninstallMutation = useMutation({
    // Lifecycle-функція ядра, а не прямий delete: деактивація знімає хуки
    // плагіна з HookRegistry — інакше слоти рендерили б «привида» до
    // перезавантаження сторінки.
    mutationFn: async (pluginName: string) => {
      const ok = await uninstallPlugin(supabase, pluginName);
      if (!ok) throw new Error(pluginName);
      return true;
    },
    onSuccess: (_success, name) => {
      toast({
        title: t('admin.plugins.deleted'),
        description: t('admin.plugins.deletedHint', { name }),
      });
      queryClient.invalidateQueries({ queryKey: PLUGINS_QUERY_KEY });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('admin.plugins.deleteFailed'),
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <NavLink to="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </NavLink>
          <div>
            <h1 className="text-2xl font-bold">{t('admin.nav.plugins')}</h1>
            <p className="text-muted-foreground">
              {t('admin.plugins.subtitle')}
            </p>
          </div>
        </div>
        {/* Runtime-встановлення (InstallPluginDialog) знято: lifecycle спеки
            §7 — build-time, `simplycms add` + запис у конфіг магазину. */}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : parsedPlugins.length === 0 ? (
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
          {parsedPlugins.map((plugin) => {
            const hasModule = registeredModules.has(plugin.name);
            const isToggling = togglingPlugin === plugin.name;

            return (
              <Card
                key={plugin.id}
                className={!plugin.is_active ? 'opacity-75' : ''}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Puzzle className="h-4 w-4" />
                        {plugin.display_name}
                      </CardTitle>
                      <CardDescription>
                        {plugin.description || t('admin.plugins.noDescription')}
                      </CardDescription>
                    </div>
                    <Switch
                      checked={plugin.is_active}
                      disabled={isToggling || !hasModule}
                      onCheckedChange={(checked) =>
                        togglePlugin({
                          name: plugin.name,
                          activate: checked,
                        })
                      }
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">v{plugin.version}</Badge>
                    {plugin.author && (
                      <Badge variant="secondary">{plugin.author}</Badge>
                    )}
                    {!hasModule && (
                      <Badge variant="destructive">
                        {t('admin.plugins.moduleMissing')}
                      </Badge>
                    )}
                    {plugin.is_active && (
                      <Badge variant="default">{t('common.activeM')}</Badge>
                    )}
                  </div>

                  {plugin.hooks.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">
                        {t('admin.plugins.hooks')}
                      </span>{' '}
                      {plugin.hooks.map((h) => h.name).join(', ')}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <NavLink
                      to={adminPath(`plugins/${plugin.id}/settings`)}
                      className="flex-1"
                    >
                      <Button variant="outline" size="sm" className="w-full">
                        <Settings className="h-4 w-4 mr-2" />
                        {t('admin.nav.settings')}
                      </Button>
                    </NavLink>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t('admin.plugins.deleteTitle')}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('admin.plugins.deleteText', {
                              name: plugin.display_name,
                            })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t('common.cancel')}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              uninstallMutation.mutate(plugin.name)
                            }
                          >
                            {t('common.delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.plugins.modules')}</CardTitle>
          <CardDescription>{t('admin.plugins.modulesHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {registeredModules.size === 0 ? (
            <p className="text-muted-foreground">
              {t('admin.plugins.modulesEmpty')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Array.from(registeredModules.keys()).map((name) => (
                <Badge key={name} variant="outline">
                  {name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
