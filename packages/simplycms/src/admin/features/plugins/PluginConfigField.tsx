import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import { Switch } from 'simplycms/ui/switch';
import type { SettingsField } from '../../lib/pluginSettingsFields';

interface PluginConfigFieldProps {
  id: string;
  field: SettingsField;
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

/**
 * Поле налаштування плагіна за JSON Schema (`settingsFields`): `boolean` —
 * перемикач, `enum` — select, `number/integer` — числовий input, решта — текст.
 */
export function PluginConfigField({
  id,
  field,
  label,
  value,
  onChange,
}: PluginConfigFieldProps) {
  if (field.type === 'boolean')
    return (
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <Switch
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
        />
      </div>
    );

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {field.enum ? (
        <Select value={String(value ?? '')} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.enum.map((option) => (
              <SelectItem key={String(option)} value={String(option)}>
                {String(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === 'number' || field.type === 'integer' ? (
        <Input
          id={id}
          type="number"
          value={String(value ?? '')}
          onChange={(e) => {
            // Порожній інпут → зняти значення (дефолт матеріалізує схема при
            // збереженні), а не писати NaN.
            const parsed = parseFloat(e.target.value);
            onChange(Number.isNaN(parsed) ? undefined : parsed);
          }}
        />
      ) : (
        <Input
          id={id}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
