import { Link } from '@tanstack/react-router';
import { Puzzle, Settings } from 'lucide-react';
import type { PluginRow } from 'simplycms/admin-server';
import { useT } from 'simplycms/i18n';
import { Badge } from 'simplycms/ui/badge';
import { Button } from 'simplycms/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'simplycms/ui/card';
import { Switch } from 'simplycms/ui/switch';
import { adminPath } from '../../lib/adminLinks';

interface PluginCardProps {
  plugin: PluginRow;
  /** Чи є модуль плагіна у збірці (`getRegisteredPluginModules`). */
  hasModule: boolean;
  isToggling: boolean;
  onToggle: (isActive: boolean) => void;
}

/**
 * Картка плагіна: перемикач і «Налаштування». Кнопки «Видалити» немає (С-3):
 * встановлення й видалення — build-time (`simplycms add` і конфіг магазину),
 * а видалений із БД рядок bootstrap однаково створив би знову.
 */
export function PluginCard({
  plugin,
  hasModule,
  isToggling,
  onToggle,
}: PluginCardProps) {
  const t = useT();
  return (
    <Card
      role="group"
      aria-label={plugin.displayName}
      className={plugin.isActive ? '' : 'opacity-75'}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Puzzle className="h-4 w-4" />
              {plugin.displayName}
            </CardTitle>
            <CardDescription>
              {plugin.description || t('admin.plugins.noDescription')}
            </CardDescription>
          </div>
          <Switch
            checked={plugin.isActive}
            // Без модуля вмикати не можна (реєстрації нема чим), а вимкнути
            // активний «осиротілий» рядок — можна й треба.
            disabled={isToggling || (!plugin.isActive && !hasModule)}
            onCheckedChange={onToggle}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">v{plugin.version}</Badge>
          {plugin.author && <Badge variant="secondary">{plugin.author}</Badge>}
          {!hasModule && (
            <Badge variant="destructive">
              {t('admin.plugins.moduleMissing')}
            </Badge>
          )}
          {plugin.isActive && (
            <Badge variant="default">{t('common.activeM')}</Badge>
          )}
        </div>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link
            to={adminPath('plugins/$pluginId/settings')}
            params={{ pluginId: plugin.id }}
          >
            <Settings className="h-4 w-4 mr-2" />
            {t('admin.nav.settings')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
