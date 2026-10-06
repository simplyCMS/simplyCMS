import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Loader2, Plug, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import type { ZodObject, ZodRawShape } from 'zod';
import type { PluginRow } from 'simplycms/admin-server';
import { useT } from 'simplycms/i18n';
import { getRegisteredPluginModules } from 'simplycms/plugins';
import { Badge } from 'simplycms/ui/badge';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { adminPath } from '../../lib/adminLinks';
import { settingsFields } from '../../lib/pluginSettingsFields';
import { reportTxError } from '../../lib/report-tx-error';
import { PluginConfigForm } from './PluginConfigForm';
import { PluginInfoCard } from './PluginInfoCard';
import { usePluginToggle } from './usePluginToggle';
import { usePlugins } from './usePlugins';

/**
 * Схема налаштувань — у зареєстрованому МОДУЛІ (`definition.settings`), не в
 * БД: Zod-схема — код, вона несеріалізовна. Читаємо на кожен рендер без
 * мемоїзації: bootstrap наповнює реєстр ПІСЛЯ першого рендера.
 */
function readSettingsSchema(name: string | undefined) {
  if (!name) return undefined;
  const module = getRegisteredPluginModules().get(name) as
    { definition?: { settings?: ZodObject<ZodRawShape> } } | undefined;
  return module?.definition?.settings;
}

/** Сторінка налаштувань плагіна (Е6б-17): конфіг через `pluginConfigWrite`. */
export default function PluginSettingsPage() {
  const t = useT();
  const { pluginId } = useParams({ strict: false }) as { pluginId: string };
  const { query, saveConfig } = usePlugins();
  const { toggle, togglingPlugin } = usePluginToggle();
  const plugin = query.data?.find((row) => row.id === pluginId);
  const schema = readSettingsSchema(plugin?.name);
  const fields = settingsFields(schema);

  if (query.isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );

  if (!plugin)
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('admin.plugins.notFound')}</p>
        <Button variant="link" asChild>
          <Link to={adminPath('plugins')}>{t('admin.plugins.backToList')}</Link>
        </Button>
      </div>
    );

  const isToggling = togglingPlugin === plugin.name;
  const hasModule = getRegisteredPluginModules().has(plugin.name);
  const save = (config: Record<string, unknown>) =>
    saveConfig.mutate(
      // Значення вже пройшло схему плагіна — далі його форму описує JSON.
      { name: plugin.name, config: config as PluginRow['config'] },
      {
        onSuccess: () => toast.success(t('common.settingsSaved')),
        onError: (e) => reportTxError(t, e),
      },
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={adminPath('plugins')}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <Plug className="h-6 w-6 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{plugin.displayName}</h1>
              <Badge variant={plugin.isActive ? 'default' : 'secondary'}>
                {plugin.isActive
                  ? t('common.activeN')
                  : t('admin.sections.inactive')}
              </Badge>
            </div>
            <p className="text-muted-foreground">v{plugin.version}</p>
          </div>
        </div>
        <Button
          variant={plugin.isActive ? 'outline' : 'default'}
          disabled={isToggling || (!plugin.isActive && !hasModule)}
          onClick={() =>
            toggle({ name: plugin.name, isActive: !plugin.isActive })
          }
        >
          {isToggling ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : plugin.isActive ? (
            <PowerOff className="h-4 w-4 mr-2" />
          ) : (
            <Power className="h-4 w-4 mr-2" />
          )}
          {plugin.isActive
            ? t('admin.plugins.deactivate')
            : t('common.activate')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {plugin.description && (
            <Card>
              <CardHeader>
                <CardTitle>{t('common.description')}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                {plugin.description}
              </CardContent>
            </Card>
          )}
          {schema && fields.length > 0 ? (
            <PluginConfigForm
              key={plugin.name}
              schema={schema}
              fields={fields}
              initial={plugin.config}
              saving={saveConfig.isPending}
              onValid={save}
              onInvalid={(issues) =>
                toast.error(`${t('common.error')}: ${issues}`)
              }
            />
          ) : (
            <Card>
              <CardContent className="text-muted-foreground text-center py-8">
                {t('admin.plugins.noSettings')}
              </CardContent>
            </Card>
          )}
        </div>
        <PluginInfoCard plugin={plugin} />
      </div>
    </div>
  );
}
