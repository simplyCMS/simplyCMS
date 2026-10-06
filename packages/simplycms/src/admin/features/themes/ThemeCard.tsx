import { Link } from '@tanstack/react-router';
import { Check, Palette, Settings } from 'lucide-react';
import type { ThemeRow } from 'simplycms/admin-server';
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
import { adminPath } from '../../lib/adminLinks';

interface ThemeCardProps {
  theme: ThemeRow;
  /** Чи є модуль теми в `ThemeRegistry` (тобто чи вона вшита у збірку). */
  hasModule: boolean;
  isActivating: boolean;
  onActivate: () => void;
}

/**
 * Картка теми у списку адмінки.
 *
 * 🔴 Рядок у БД і вшитий модуль — різні шари: рядок лишається після
 * видалення пакета теми. Активувати таку тему безглуздо (сервер відмовить
 * `theme_not_built`), тож кнопка вимкнена, а бейдж і підказка пояснюють
 * причину ще до запиту.
 */
export function ThemeCard({
  theme,
  hasModule,
  isActivating,
  onActivate,
}: ThemeCardProps) {
  const t = useT();
  const settingsLink = (
    <Link
      to={adminPath('themes/$themeId/settings')}
      params={{ themeId: theme.id }}
    >
      <Settings className="h-4 w-4 mr-2" />
      {t('admin.nav.settings')}
    </Link>
  );

  return (
    <Card
      role="group"
      aria-label={theme.displayName}
      className={theme.isActive ? 'ring-2 ring-primary' : ''}
    >
      <div className="relative h-48 bg-muted rounded-t-lg overflow-hidden">
        {theme.previewImage ? (
          <img
            src={theme.previewImage}
            alt={theme.displayName}
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
        {theme.isActive && (
          <Badge className="absolute top-3 right-3 gap-1">
            <Check className="h-3 w-3" />
            {t('common.activeF')}
          </Badge>
        )}
      </div>

      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {theme.displayName}
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
          {!theme.isActive && (
            <Button
              className="flex-1"
              onClick={onActivate}
              disabled={isActivating || !hasModule}
            >
              {t('common.activate')}
            </Button>
          )}
          <Button
            variant="outline"
            className={theme.isActive ? 'flex-1' : ''}
            asChild
          >
            {settingsLink}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
