import { Link } from '@tanstack/react-router';
import { ArrowLeft, Loader2, Plug, Power, PowerOff } from 'lucide-react';
import type { PluginRow } from 'simplycms/admin-server';
import { useT } from 'simplycms/i18n';
import { Badge } from 'simplycms/ui/badge';
import { Button } from 'simplycms/ui/button';
import { adminPath } from '../../lib/adminLinks';

interface PluginSettingsHeaderProps {
  plugin: PluginRow;
  hasModule: boolean;
  isToggling: boolean;
  onToggle: () => void;
}

/**
 * Шапка сторінки налаштувань плагіна: назва, статус і перемикач. Правило
 * `disabled` те саме, що в `PluginCard`: без модуля не ввімкнути, а активний
 * «осиротілий» рядок вимкнути можна.
 */
export function PluginSettingsHeader({
  plugin,
  hasModule,
  isToggling,
  onToggle,
}: PluginSettingsHeaderProps) {
  const t = useT();
  return (
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
        onClick={onToggle}
      >
        {isToggling ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : plugin.isActive ? (
          <PowerOff className="h-4 w-4 mr-2" />
        ) : (
          <Power className="h-4 w-4 mr-2" />
        )}
        {plugin.isActive ? t('admin.plugins.deactivate') : t('common.activate')}
      </Button>
    </div>
  );
}
