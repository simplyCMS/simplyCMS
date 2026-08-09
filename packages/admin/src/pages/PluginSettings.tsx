import { useParams, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { useT } from '@simplycms/i18n';
import { Button } from '@simplycms/ui/button';
import { Input } from '@simplycms/ui/input';
import { Label } from '@simplycms/ui/label';
import { Switch } from '@simplycms/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@simplycms/ui/card';
import { Badge } from '@simplycms/ui/badge';
import { Separator } from '@simplycms/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@simplycms/ui/select';
import { useToast } from '@simplycms/core/hooks/use-toast';
import {
  ArrowLeft,
  Loader2,
  Save,
  Power,
  PowerOff,
  Plug,
  Settings,
} from 'lucide-react';
import { adminPath } from '../lib/adminLinks';
import { useState, useEffect } from 'react';
import {
  parsePlugin,
  type Plugin,
  type PluginSettingDefinition,
} from '@simplycms/plugins/types';

export default function PluginSettings() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { pluginId } = useParams({ strict: false }) as { pluginId: string };
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [config, setConfig] = useState<Record<string, unknown>>({});

  const { data: plugin, isLoading } = useQuery({
    queryKey: ['plugin', pluginId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plugins')
        .select('*')
        .eq('id', pluginId)
        .single();
      if (error) throw error;
      return parsePlugin({
        ...data,
        is_active: data.is_active ?? false,
      } as Plugin);
    },
  });

  // Load plugin manifest to get settings definitions
  const { data: manifest } = useQuery({
    queryKey: ['plugin-manifest', plugin?.name],
    queryFn: async () => {
      if (!plugin?.name) return null;
      try {
        // Специфікатор рахується у змінну навмисно: інлайн-літерал bundler
        // намагається розгорнути в glob ще до резолверів і валить збірку
        // пакета. Шлях `../../plugins/**` з теки пакета не існує — імпорт
        // завжди кидає й дає null; лишається до фікса завантаження
        // маніфестів у plugin-system.
        const manifestPath = `../../plugins/${plugin.name}/manifest.json`;
        const pluginModule = await import(/* @vite-ignore */ manifestPath);
        return pluginModule.default || pluginModule;
      } catch {
        return null;
      }
    },
    enabled: !!plugin?.name,
  });

  useEffect(() => {
    if (plugin?.config) {
      setConfig(plugin.config);
    }
  }, [plugin]);

  const toggleMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const { error } = await supabase
        .from('plugins')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', pluginId);
      if (error) throw error;
    },
    onSuccess: (_, isActive) => {
      queryClient.invalidateQueries({ queryKey: ['plugin', pluginId] });
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
      toast({
        title: isActive
          ? t('admin.plugins.enabled')
          : t('admin.plugins.disabled'),
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message,
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newConfig: Record<string, unknown>) => {
      const { error } = await supabase
        .from('plugins')
        .update({
          config: newConfig as unknown as Record<string, never>,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pluginId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin', pluginId] });
      toast({ title: t('common.settingsSaved') });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message,
      });
    },
  });

  const handleConfigChange = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!plugin) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('admin.plugins.notFound')}</p>
        <Button
          variant="link"
          onClick={() => navigate({ to: adminPath('plugins') })}
        >
          {t('admin.plugins.backToList')}
        </Button>
      </div>
    );
  }

  const settings = manifest?.settings as
    Record<string, PluginSettingDefinition> | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: adminPath('plugins') })}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Plug className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">{plugin.display_name}</h1>
                <Badge variant={plugin.is_active ? 'default' : 'secondary'}>
                  {plugin.is_active
                    ? t('common.activeN')
                    : t('admin.sections.inactive')}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                v{plugin.version} {plugin.author && `• ${plugin.author}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={plugin.is_active ? 'outline' : 'default'}
            onClick={() => toggleMutation.mutate(!plugin.is_active)}
            disabled={toggleMutation.isPending}
          >
            {toggleMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : plugin.is_active ? (
              <PowerOff className="h-4 w-4 mr-2" />
            ) : (
              <Power className="h-4 w-4 mr-2" />
            )}
            {plugin.is_active
              ? t('admin.plugins.deactivate')
              : t('common.activate')}
          </Button>
          {settings && Object.keys(settings).length > 0 && (
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t('common.save')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {plugin.description && (
            <Card>
              <CardHeader>
                <CardTitle>{t('common.description')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{plugin.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Settings */}
          {settings && Object.keys(settings).length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {t('admin.nav.settings')}
                </CardTitle>
                <CardDescription>
                  {t('admin.plugins.settingsHint')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(settings).map(([key, setting]) => (
                  <div key={key} className="space-y-2">
                    {setting.type === 'boolean' ? (
                      <div className="flex items-center justify-between">
                        <Label htmlFor={key}>{setting.label}</Label>
                        <Switch
                          id={key}
                          checked={Boolean(config[key] ?? setting.default)}
                          onCheckedChange={(checked) =>
                            handleConfigChange(key, checked)
                          }
                        />
                      </div>
                    ) : setting.type === 'select' ? (
                      <>
                        <Label htmlFor={key}>{setting.label}</Label>
                        <Select
                          value={
                            (config[key] as string) ?? String(setting.default)
                          }
                          onValueChange={(value) =>
                            handleConfigChange(key, value)
                          }
                        >
                          <SelectTrigger id={key}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {setting.options?.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    ) : setting.type === 'number' ? (
                      <>
                        <Label htmlFor={key}>{setting.label}</Label>
                        <Input
                          id={key}
                          type="number"
                          value={String(config[key] ?? setting.default ?? '')}
                          onChange={(e) =>
                            handleConfigChange(key, parseFloat(e.target.value))
                          }
                        />
                      </>
                    ) : (
                      <>
                        <Label htmlFor={key}>{setting.label}</Label>
                        <Input
                          id={key}
                          value={String(config[key] ?? setting.default ?? '')}
                          onChange={(e) =>
                            handleConfigChange(key, e.target.value)
                          }
                        />
                      </>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {t('admin.nav.settings')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-4">
                  {t('admin.plugins.noSettings')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Hooks */}
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.plugins.registeredHooks')}</CardTitle>
              <CardDescription>
                {t('admin.plugins.registeredHooksHint')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {plugin.hooks.length > 0 ? (
                <div className="space-y-2">
                  {plugin.hooks.map((hook, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <code className="text-sm">{hook.name}</code>
                      {hook.priority !== undefined && (
                        <Badge variant="outline" className="text-xs">
                          {hook.priority}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  {t('admin.plugins.noHooks')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('common.information')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-xs">
                  {plugin.id.slice(0, 8)}...
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('common.name')}
                </span>
                <span className="font-mono">{plugin.name}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('admin.plugins.version')}
                </span>
                <span>{plugin.version}</span>
              </div>
              {plugin.author && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('common.author')}
                    </span>
                    <span>{plugin.author}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('admin.plugins.installedAt')}
                </span>
                <span>
                  {new Date(plugin.installed_at).toLocaleDateString('uk-UA')}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('admin.plugins.updatedAt')}
                </span>
                <span>
                  {new Date(plugin.updated_at).toLocaleDateString('uk-UA')}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
