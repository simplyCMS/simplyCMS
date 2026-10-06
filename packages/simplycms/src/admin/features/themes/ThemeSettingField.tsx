import { useState } from 'react';
import type { ThemeSettingDefinition } from 'simplycms/themes/types';
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

interface ThemeSettingFieldProps {
  id: string;
  setting: ThemeSettingDefinition;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  /** Перекладений текст помилки поля (межі `min`/`max` — `themeSettingErrors`). */
  error?: string;
}

/**
 * Число зберігається ЧИСЛОМ (Review Focus 5): сервер приймає `number` як є і
 * рядок у число не приводить. Сирий текст живе локально, щоб поле можна було
 * очистити й набрати заново; у форму йде лише валідне число.
 */
function NumberField({
  id,
  setting,
  value,
  onChange,
  error,
}: ThemeSettingFieldProps) {
  const [raw, setRaw] = useState(String(value));
  return (
    <Input
      id={id}
      type="number"
      min={setting.min}
      max={setting.max}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      value={raw}
      onChange={(e) => {
        const next = e.target.value;
        setRaw(next);
        // `Number('')` дало б 0 — порожнє поле в форму не пишемо.
        if (next.trim() !== '' && Number.isFinite(Number(next)))
          onChange(Number(next));
      }}
    />
  );
}

/** Поле однієї настройки теми — усі пʼять типів `ThemeSettingDefinition`. */
export function ThemeSettingField(props: ThemeSettingFieldProps) {
  const { id, setting, value, onChange } = props;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{setting.label}</Label>
      {setting.type === 'boolean' && (
        <Switch
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
        />
      )}
      {setting.type === 'color' && (
        <Input
          id={id}
          type="color"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 h-10"
        />
      )}
      {setting.type === 'select' && (
        <Select value={String(value)} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(setting.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {setting.type === 'text' && (
        <Input
          id={id}
          type="text"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {setting.type === 'number' && <NumberField {...props} />}
      {props.error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {props.error}
        </p>
      )}
      {setting.description && (
        <p className="text-sm text-muted-foreground">{setting.description}</p>
      )}
    </div>
  );
}
