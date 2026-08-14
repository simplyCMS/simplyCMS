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
import type { ZodObject, ZodRawShape } from 'zod';
import { getRegisteredPluginModules } from '@simplycms/plugins';
import { parsePlugin, type Plugin } from '@simplycms/plugins/types';
import { adminPath } from '../lib/adminLinks';
import { settingsFields } from '../lib/pluginSettingsFields';
import { useState, useEffect, useMemo } from 'react';
import { usePluginToggle } from '../hooks/usePluginToggle';

/**
 * Схема налаштувань береться з зареєстрованого МОДУЛЯ плагіна
 * (`bootstrapPlugins` наповнює реєстр із конфіга магазину), а не з БД чи
 * manifest.json: Zod-схема — код, вона несеріалізовна. Наслідок §8: якщо
 * плагін активний у БД, але модуль викинули з білда, — форма недоступна,
 * сторінка показує «немає налаштувань».
 *
 * Без useMemo навмисно: bootstrap наповнює реєстр асинхронно ПІСЛЯ першого
 * рендера, і мемоїзація по pluginName закешувала б «модуля немає» назавжди
 * (знахідка рев'ю Фази 3). Читання реєстру на кожен рендер — копійки, так
 * само робить Plugins.tsx.
 */
function readSettingsSchema(
  pluginName: string | undefined,
): ZodObject<ZodRawShape> | undefined {
  if (!pluginName) return undefined;
  const module = getRegisteredPluginModules().get(pluginName);
  const definition = (
    module as { definition?: { settings?: ZodObject<ZodRawShape> } } | undefined
  )?.definition;
  return definition?.settings;
}

export default function PluginSettings() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { pluginId } = useParams({ strict: false }) as { pluginId: string };
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { togglePlugin, togglingPlugin } = usePluginToggle();

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

  const schema = readSettingsSchema(plugin?.name);
  const fields = useMemo(() => settingsFields(schema), [schema]);

  useEffect(() => {
    if (plugin?.config) {
      setConfig(plugin.config);
    }
  }, [plugin]);

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
    if (!schema) return;
    // Zod валідує І матеріалізує дефолти: у БД їде повний config, а не
    // лише торкнуті поля.
    const parsed = schema.safeParse(config);
    if (!parsed.success) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; '),
      });
      return;
    }
    saveMutation.mutate(parsed.data as Record<string, unknown>);
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

  const isToggling = togglingPlugin === plugin.name;

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
            onClick={() =>
              // Єдиний механізм перемикання — usePluginToggle (БД + реєстр
              // хуків атомарно); прямий supabase.update лишав би HookRegistry
              // незмінним до перезавантаження сторінки.
              togglePlugin(
                { name: plugin.name, activate: !plugin.is_active },
                {
                  onSettled: () => {
                    void queryClient.invalidateQueries({
                      queryKey: ['plugin', pluginId],
                    });
                  },
                },
              )
            }
            disabled={isToggling}
          >
            {isToggling ? (
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
          {fields.length > 0 && (
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
          {fields.length > 0 ? (
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
                {fields.map(([key, field]) => (
                  <div key={key} className="space-y-2">
                    {field.type === 'boolean' ? (
                      <div className="flex items-center justify-between">
                        <Label htmlFor={key}>{field.description ?? key}</Label>
                        <Switch
                          id={key}
                          checked={Boolean(config[key] ?? field.default)}
                          onCheckedChange={(checked) =>
                            handleConfigChange(key, checked)
                          }
                        />
                      </div>
                    ) : field.enum ? (
                      <>
                        <Label htmlFor={key}>{field.description ?? key}</Label>
                        <Select
                          value={String(config[key] ?? field.default ?? '')}
                          onValueChange={(value) =>
                            handleConfigChange(key, value)
                          }
                        >
                          <SelectTrigger id={key}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {field.enum.map((option) => (
                              <SelectItem
                                key={String(option)}
                                value={String(option)}
                              >
                                {String(option)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    ) : field.type === 'number' || field.type === 'integer' ? (
                      <>
                        <Label htmlFor={key}>{field.description ?? key}</Label>
                        <Input
                          id={key}
                          type="number"
                          value={String(config[key] ?? field.default ?? '')}
                          onChange={(e) => {
                            // Порожній інпут → зняти ключ (дефолт матеріалізує
                            // safeParse при збереженні), а не писати NaN.
                            const parsed = parseFloat(e.target.value);
                            handleConfigChange(
                              key,
                              Number.isNaN(parsed) ? undefined : parsed,
                            );
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <Label htmlFor={key}>{field.description ?? key}</Label>
                        <Input
                          id={key}
                          value={String(config[key] ?? field.default ?? '')}
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
