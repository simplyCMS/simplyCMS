import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form';
import { Label } from 'simplycms/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';

export interface SelectOption {
  readonly value: string;
  readonly text: string;
  readonly disabled?: boolean;
}

interface Props<T extends FieldValues> {
  readonly control: Control<T>;
  readonly name: Path<T>;
  readonly id: string;
  readonly label: string;
  readonly options: readonly SelectOption[];
  readonly disabled?: boolean;
  /** Текст, поки значення порожнє (немає опції з таким value). */
  readonly placeholder?: string;
  /** Підказка або текст помилки під полем. */
  readonly note?: string;
  readonly noteIsError?: boolean;
}

/** Select форми shipping: лейбл, список опцій, підказка/помилка під полем. */
export function SelectField<T extends FieldValues>({
  control,
  name,
  id,
  label,
  options,
  disabled,
  placeholder,
  note,
  noteIsError,
}: Props<T>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            value={String(field.value ?? '')}
            // Radix відправляє '' зі службового native-select, коли набір
            // опцій змінюється під час роботи (опції вантажаться з колекції):
            // справжні значення тут не порожні, тож ігноруємо.
            onValueChange={(v) => v !== '' && field.onChange(v)}
            disabled={disabled}
          >
            <SelectTrigger id={id}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                  {o.text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {note && (
        <p
          role={noteIsError ? 'alert' : undefined}
          className={
            noteIsError
              ? 'text-xs text-destructive'
              : 'text-xs text-muted-foreground'
          }
        >
          {note}
        </p>
      )}
    </div>
  );
}
