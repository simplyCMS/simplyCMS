import { useT } from 'simplycms/i18n';
import type { UserCategory } from 'simplycms/schema/types';
import { Input } from 'simplycms/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import { cn } from 'simplycms/ui/utils';
import type { BuiltInConditionType } from './condition-catalog';

interface Props {
  readonly type: BuiltInConditionType;
  readonly value: unknown;
  readonly categories: readonly UserCategory[];
  readonly onChange: (value: unknown) => void;
}

/**
 * Поле значення вбудованої умови. Значення пишеться як є (порожнє число —
 * `null`): чи воно в межах контракту, вирішує реєстр у схемі форми, а не
 * поле — так межі `min_quantity` (ред.4 Е6в-4) живуть в ОДНОМУ місці.
 */
export function ConditionValueEditor({
  type,
  value,
  categories,
  onChange,
}: Props) {
  const t = useT();
  if (type === 'user_category') {
    const ids = Array.isArray(value) ? (value as unknown[]) : [];
    return (
      <div className="flex flex-1 flex-wrap gap-1">
        {categories.map((c) => {
          const on = ids.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs',
                on && 'border-primary bg-primary text-primary-foreground',
              )}
              onClick={() =>
                onChange(on ? ids.filter((id) => id !== c.id) : [...ids, c.id])
              }
            >
              {c.name}
            </button>
          );
        })}
      </div>
    );
  }
  if (type === 'user_logged_in')
    return (
      <Select
        value={String(value === true)}
        onValueChange={(v) => v !== '' && onChange(v === 'true')}
      >
        <SelectTrigger
          className="w-36"
          aria-label={t('admin.discounts.authenticated')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">{t('common.yes')}</SelectItem>
          <SelectItem value="false">{t('admin.discounts.guestNo')}</SelectItem>
        </SelectContent>
      </Select>
    );
  return (
    <Input
      type="number"
      className="w-32"
      min={0}
      step={type === 'min_quantity' ? 1 : 0.01}
      aria-label={t('common.value')}
      value={typeof value === 'number' ? value : ''}
      onChange={(e) =>
        onChange(e.target.value === '' ? null : Number(e.target.value))
      }
    />
  );
}
