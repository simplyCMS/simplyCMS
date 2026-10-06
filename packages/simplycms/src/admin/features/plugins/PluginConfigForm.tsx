import { useState } from 'react';
import { Loader2, Save, Settings } from 'lucide-react';
import type { ZodObject, ZodRawShape } from 'zod';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'simplycms/ui/card';
import type { SettingsField } from '../../lib/pluginSettingsFields';
import { PluginConfigField } from './PluginConfigField';

interface PluginConfigFormProps {
  schema: ZodObject<ZodRawShape>;
  fields: [string, SettingsField][];
  initial: Record<string, unknown>;
  saving: boolean;
  /** Значення пройшло схему плагіна (дефолти матеріалізовані). */
  onValid: (config: Record<string, unknown>) => void;
  /** Опис проблем схеми для тоста. */
  onInvalid: (issues: string) => void;
}

/**
 * Форма налаштувань плагіна. Zod-схема модуля валідує В БРАУЗЕРІ й
 * матеріалізує дефолти: сервер схеми не знає (модуль живе в браузері), тож у
 * `plugins.config` їде повний конфіг, а не лише торкнуті поля.
 */
export function PluginConfigForm({
  schema,
  fields,
  initial,
  saving,
  onValid,
  onInvalid,
}: PluginConfigFormProps) {
  const t = useT();
  const [config, setConfig] = useState(initial);

  const submit = () => {
    const parsed = schema.safeParse(config);
    if (parsed.success) onValid(parsed.data as Record<string, unknown>);
    else
      onInvalid(
        parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; '),
      );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('admin.nav.settings')}
          </CardTitle>
          <CardDescription>{t('admin.plugins.settingsHint')}</CardDescription>
        </div>
        <Button onClick={submit} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {t('common.save')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {fields.map(([key, field]) => (
          <PluginConfigField
            key={key}
            id={`plugin-setting-${key}`}
            field={field}
            label={field.description ?? key}
            value={config[key] ?? field.default}
            onChange={(value) =>
              setConfig((prev) => ({ ...prev, [key]: value }))
            }
          />
        ))}
      </CardContent>
    </Card>
  );
}
