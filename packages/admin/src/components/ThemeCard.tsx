import { Link } from '@tanstack/react-router';
import { Button } from '@simplycms/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@simplycms/ui/card';
import { Badge } from '@simplycms/ui/badge';
import { Palette, Check, Settings } from 'lucide-react';
import { useT } from 'simplycms/i18n';
import { adminPath } from '../lib/adminLinks';

/** Рядок таблиці `themes` у тому обсязі, який показує адмінка. */
export interface ThemeRecord {
  id: string;
  name: string;
  display_name: string;
  version: string;
  description: string | null;
  author: string | null;
  preview_image: string | null;
  is_active: boolean;
  created_at: string;
}

interface ThemeCardProps {
  theme: ThemeRecord;
  /** Чи є модуль теми в `ThemeRegistry` (тобто чи вона встановлена в коді). */
  hasModule: boolean;
  isActivating: boolean;
  onActivate: () => void;
}

/**
 * Картка теми у списку адмінки.
 *
 * 🔴 Registry-awareness: рядок у БД і встановлений модуль — різні шари.
 * Рядок може лишитися від міграції/сіду, тоді як пакет теми в магазині не
 * стоїть. Активувати таку тему безглуздо (SSR упав би на `default`), тож
 * кнопка disabled, а бейдж пояснює причину — дзеркало `hasModule` у Plugins.
 */
export function ThemeCard({
  theme,
  hasModule,
  isActivating,
  onActivate,
}: ThemeCardProps) {
  const t = useT();

  return (
    <Card className={theme.is_active ? 'ring-2 ring-primary' : ''}>
      <div className="relative h-48 bg-muted rounded-t-lg overflow-hidden">
        {theme.preview_image ? (
          <img
            src={theme.preview_image}
            alt={theme.display_name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Palette className="h-16 w-16 text-muted-foreground/50" />
          </div>
        )}
        {!hasModule && (
          <Badge variant="destructive" className="absolute top-3 left-3">
            {t('admin.themes.moduleMissing')}
          </Badge>
        )}
        {theme.is_active && (
          <Badge className="absolute top-3 right-3 gap-1">
            <Check className="h-3 w-3" />
            {t('common.activeF')}
          </Badge>
        )}
      </div>

      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {theme.display_name}
          <span className="text-sm font-normal text-muted-foreground">
            v{theme.version}
          </span>
        </CardTitle>
        <CardDescription>
          {theme.author && (
            <span>
              {t('admin.themes.author')} {theme.author}
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {theme.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {theme.description}
          </p>
        )}
        {!hasModule && (
          <p className="text-sm text-destructive">
            {t('admin.themes.moduleMissingHint')}
          </p>
        )}

        <div className="flex gap-2">
          {theme.is_active ? (
            <Button variant="outline" className="flex-1" asChild>
              <Link
                to={adminPath('themes/$themeId/settings')}
                params={{ themeId: theme.id }}
              >
                <Settings className="h-4 w-4 mr-2" />
                {t('admin.nav.settings')}
              </Link>
            </Button>
          ) : (
            <>
              <Button
                className="flex-1"
                onClick={onActivate}
                disabled={isActivating || !hasModule}
              >
                {t('common.activate')}
              </Button>
              <Button variant="outline" size="icon" asChild>
                <Link
                  to={adminPath('themes/$themeId/settings')}
                  params={{ themeId: theme.id }}
                >
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
