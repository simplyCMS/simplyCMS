import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import type { ThemeRow } from 'simplycms/admin-server';
import { useT } from 'simplycms/i18n';
import type { ThemeSettingDefinition } from 'simplycms/themes/types';
import { Button } from 'simplycms/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'simplycms/ui/card';
import { ThemeSettingField } from './ThemeSettingField';
import { themeSettingErrors } from './themeSettingErrors';
import type { ThemeSettingsValues } from './useThemes';

type Schema = Record<string, ThemeSettingDefinition>;

/**
 * Значення форми: дефолт схеми, поверх — збережене, якщо воно примітив.
 * jsonb рядка могли записати ручним SQL, тож вкладене значення ігнорується,
 * а не їде назад на сервер (там воно дало б 400).
 */
export function initialValues(
  schema: Schema,
  saved: ThemeRow['settings'],
): ThemeSettingsValues {
  const values: ThemeSettingsValues = {};
  for (const [key, setting] of Object.entries(schema)) {
    const stored = saved[key];
    values[key] =
      typeof stored === 'string' ||
      typeof stored === 'number' ||
      typeof stored === 'boolean'
        ? stored
        : setting.default;
  }
  return values;
}

interface ThemeSettingsFormProps {
  theme: ThemeRow;
  schema: Schema;
  saving: boolean;
  onSave: (settings: ThemeSettingsValues) => void;
}

/**
 * Форма налаштувань теми. Шле лише ключі схеми: ключ, якого тема більше не
 * декларує, не воскресає з БД при кожному збереженні.
 */
export function ThemeSettingsForm({
  theme,
  schema,
  saving,
  onSave,
}: ThemeSettingsFormProps) {
  const t = useT();
  const [values, setValues] = useState(() =>
    initialValues(schema, theme.settings),
  );
  // Помилки показуються після спроби зберегти, а не під час набору.
  const [errors, setErrors] = useState<ReturnType<typeof themeSettingErrors>>(
    {},
  );
  const entries = Object.entries(schema);

  const save = () => {
    const found = themeSettingErrors(schema, values);
    setErrors(found);
    if (Object.keys(found).length === 0) onSave(values);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{t('admin.nav.settings')}</CardTitle>
          <CardDescription>
            {t('admin.themes.settingsSubtitle')}
          </CardDescription>
        </div>
        {entries.length > 0 && (
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t('common.save')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {entries.length === 0 ? (
          <p className="text-muted-foreground">
            {t('admin.themes.noSettings')}
          </p>
        ) : (
          entries.map(([key, setting]) => {
            const error = errors[key];
            return (
              <ThemeSettingField
                key={key}
                id={`theme-setting-${key}`}
                setting={setting}
                value={values[key]!}
                error={
                  error &&
                  (error.kind === 'min'
                    ? t('admin.themes.settingMin', { min: error.bound })
                    : t('admin.themes.settingMax', { max: error.bound }))
                }
                onChange={(value) => {
                  setValues((prev) => ({ ...prev, [key]: value }));
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  });
                }}
              />
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
