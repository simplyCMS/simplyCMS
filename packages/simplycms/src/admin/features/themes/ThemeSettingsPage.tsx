import { useEffect, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Loader2, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from 'simplycms/i18n';
import { ThemeRegistry } from 'simplycms/themes/ThemeRegistry';
import type { ThemeSettingDefinition } from 'simplycms/themes/types';
import { Button } from 'simplycms/ui/button';
import { adminPath } from '../../lib/adminLinks';
import { reportTxError } from '../../lib/report-tx-error';
import { ThemeSettingsForm } from './ThemeSettingsForm';
import { useThemes } from './useThemes';

type Schema = Record<string, ThemeSettingDefinition>;

/**
 * Схема налаштувань — у МОДУЛІ теми (контракт v2), а модуль живе лише в
 * браузері: сервер схеми не знає (Е6б-16). Тема без модуля у збірці — форма
 * порожня («немає налаштувань»), а не падіння сторінки. `null` — ще вантажимо.
 */
function useThemeSchema(name: string | undefined): Schema | null {
  const [schema, setSchema] = useState<{ name: string; value: Schema }>();
  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    const done = (value: Schema) => {
      if (!cancelled) setSchema({ name, value });
    };
    if (!ThemeRegistry.has(name)) done({});
    else
      ThemeRegistry.load(name).then(
        (module) => done(module.settings ?? {}),
        () => done({}),
      );
    return () => {
      cancelled = true;
    };
  }, [name]);
  return schema && schema.name === name ? schema.value : null;
}

/** Сторінка налаштувань теми (Е6б-16): `saveThemeSettings` + write-back. */
export default function ThemeSettingsPage() {
  const t = useT();
  const { themeId } = useParams({ strict: false }) as { themeId: string };
  const { query, saveSettings } = useThemes();
  const theme = query.data?.find((row) => row.id === themeId);
  const schema = useThemeSchema(theme?.name);

  if (query.isLoading || (theme && !schema))
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );

  if (!theme || !schema)
    return (
      <div className="text-center py-12">
        <Palette className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t('admin.themes.notFound')}
        </h2>
        <Button asChild>
          <Link to={adminPath('themes')}>{t('admin.themes.back')}</Link>
        </Button>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={adminPath('themes')}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{theme.displayName}</h1>
          <p className="text-muted-foreground">v{theme.version}</p>
        </div>
      </div>
      <ThemeSettingsForm
        key={theme.name}
        theme={theme}
        schema={schema}
        saving={saveSettings.isPending}
        onSave={(settings) =>
          saveSettings.mutate(
            { name: theme.name, settings },
            {
              onSuccess: () => toast.success(t('common.settingsSaved')),
              onError: (e) => reportTxError(t, e),
            },
          )
        }
      />
    </div>
  );
}
